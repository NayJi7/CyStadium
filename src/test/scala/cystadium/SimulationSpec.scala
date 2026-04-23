package cystadium

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import akka.testkit.{TestKit, TestProbe}
import com.typesafe.config.ConfigFactory
import cystadium.actors.ReservationHandler.SeatRefResolver
import cystadium.actors.{ReservationHandler, SeatAllocator}
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.time.Instant
import java.util.UUID
import scala.concurrent.duration._

object SimulationSpec {
  final class FakeSessionManager(sessions: Map[SessionId, ClientId]) extends Actor {
    override def receive: Receive = {
      case ValidateSession(sessionId) =>
        sessions.get(sessionId) match {
          case Some(clientId) => sender() ! SessionValid(clientId)
          case None           => sender() ! SessionInvalid
        }
    }
  }

  object FakeSessionManager {
    def props(sessions: Map[SessionId, ClientId]): Props =
      Props(new FakeSessionManager(sessions))
  }

  final class FakeSeatActor(seatId: SeatId) extends Actor {
    private var status: SeatStatus = Free

    override def receive: Receive = {
      case ReserveSeat(clientId, bookingId, deadline) =>
        status match {
          case Free =>
            status = Reserved(clientId, bookingId, deadline)
            sender() ! SeatReservedOk(seatId)
          case current =>
            sender() ! SeatUnavailable(seatId, current)
        }

      case ConfirmSeat(bookingId) =>
        status match {
          case Reserved(clientId, currentBookingId, _) if currentBookingId == bookingId =>
            status = Confirmed(clientId, bookingId)
            sender() ! SeatConfirmedOk(seatId)
          case _ =>
        }

      case ReleaseSeat(bookingId) =>
        status match {
          case Reserved(_, currentBookingId, _) if currentBookingId == bookingId =>
            status = Free
            sender() ! SeatReleasedOk(seatId)
          case _ =>
        }

      case GetSeatStatus =>
        sender() ! SeatStatusResponse(seatId, status)
    }
  }

  object FakeSeatActor {
    def props(seatId: SeatId): Props =
      Props(new FakeSeatActor(seatId))
  }

  final case class Client(clientId: ClientId, sessionId: SessionId)
}

final class SimulationSpec
    extends TestKit(ActorSystem("SimulationSpec", ConfigFactory.parseString("akka.loglevel = WARNING")))
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll {

  import SimulationSpec._

  override def afterAll(): Unit =
    TestKit.shutdownActorSystem(system)

  "CyStadium reservation simulation" should {
    "S1 reserve and confirm one client reservation" in {
      val fixture = new Fixture(seatCount = 1, clientCount = 1)
      val requester = TestProbe()

      requester.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, Set(fixture.seatIds.head)))
      val reserved = requester.expectMsgType[SeatsReserved]

      requester.send(fixture.handler, ConfirmReservation(reserved.reservationId))
      requester.expectMsgType[ReservationConfirmed].reservationId shouldBe reserved.reservationId

      fixture.statusOf(fixture.seatIds.head) shouldBe a[Confirmed]
    }

    "S2 rollback when one requested seat is unavailable" in {
      val fixture = new Fixture(seatCount = 2, clientCount = 2)
      val firstClient = fixture.clients.head
      val secondClient = fixture.clients(1)
      val requester = TestProbe()
      val seatA = fixture.seatIds.head
      val seatB = fixture.seatIds(1)

      requester.send(fixture.handler, fixture.reserveSeats(firstClient, Set(seatB)))
      requester.expectMsgType[SeatsReserved]

      requester.send(fixture.handler, fixture.reserveSeats(secondClient, Set(seatA, seatB)))
      requester.expectMsgType[SeatsUnavailable].conflictingSeats should contain(seatB)

      fixture.statusOf(seatA) shouldBe Free
      fixture.statusOf(seatB) shouldBe a[Reserved]
    }

    "S3 release pending seats when the reservation expires" in {
      val fixture = new Fixture(seatCount = 1, clientCount = 1, reservationTtl = 200.millis)
      val requester = TestProbe()
      val seatId = fixture.seatIds.head

      requester.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, Set(seatId)))
      requester.expectMsgType[SeatsReserved]
      fixture.statusOf(seatId) shouldBe a[Reserved]

      awaitAssert({
        fixture.statusOf(seatId) shouldBe Free
      }, 1.second, 50.millis)
    }

    "S4 accept only one of two concurrent clients for the same seat" in {
      val fixture = new Fixture(seatCount = 1, clientCount = 2)
      val requesterA = TestProbe()
      val requesterB = TestProbe()
      val seatId = fixture.seatIds.head

      requesterA.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, Set(seatId)))
      requesterB.send(fixture.handler, fixture.reserveSeats(fixture.clients(1), Set(seatId)))

      val responses = requesterA.receiveOne(1.second) :: requesterB.receiveOne(1.second) :: Nil
      responses.count(_.isInstanceOf[SeatsReserved]) shouldBe 1
      responses.count(_.isInstanceOf[SeatsUnavailable]) shouldBe 1
      fixture.statusOf(seatId) shouldBe a[Reserved]
    }

    "S5 allow two clients to reserve different seats in parallel" in {
      val fixture = new Fixture(seatCount = 2, clientCount = 2)
      val requesterA = TestProbe()
      val requesterB = TestProbe()

      requesterA.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, Set(fixture.seatIds.head)))
      requesterB.send(fixture.handler, fixture.reserveSeats(fixture.clients(1), Set(fixture.seatIds(1))))

      requesterA.expectMsgType[SeatsReserved]
      requesterB.expectMsgType[SeatsReserved]
      fixture.seatIds.foreach(seatId => fixture.statusOf(seatId) shouldBe a[Reserved])
    }

    "S6 reserve three seats atomically for one client" in {
      val fixture = new Fixture(seatCount = 3, clientCount = 1)
      val requester = TestProbe()

      requester.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, fixture.seatIds.toSet))
      val reserved = requester.expectMsgType[SeatsReserved]

      reserved.seatIds shouldBe fixture.seatIds.toSet
      reserved.total shouldBe 1500.0
      fixture.seatIds.foreach(seatId => fixture.statusOf(seatId) shouldBe a[Reserved])
    }

    "S8 reject the third client when three clients compete for two seats" in {
      val fixture = new Fixture(seatCount = 2, clientCount = 3)
      val requesterA = TestProbe()
      val requesterB = TestProbe()
      val requesterC = TestProbe()
      val seatA = fixture.seatIds.head
      val seatB = fixture.seatIds(1)

      requesterA.send(fixture.handler, fixture.reserveSeats(fixture.clients.head, Set(seatA)))
      requesterB.send(fixture.handler, fixture.reserveSeats(fixture.clients(1), Set(seatB)))
      requesterC.send(fixture.handler, fixture.reserveSeats(fixture.clients(2), Set(seatA)))

      val responses = List(
        requesterA.receiveOne(1.second),
        requesterB.receiveOne(1.second),
        requesterC.receiveOne(1.second)
      )

      responses.count(_.isInstanceOf[SeatsReserved]) shouldBe 2
      responses.count(_.isInstanceOf[SeatsUnavailable]) shouldBe 1
      fixture.statusOf(seatA) shouldBe a[Reserved]
      fixture.statusOf(seatB) shouldBe a[Reserved]
    }
  }

  private final class Fixture(
      seatCount: Int,
      clientCount: Int,
      reservationTtl: FiniteDuration = 10.minutes
  ) {
    val matchId: MatchId = UUID.randomUUID()
    val seatIds: Vector[SeatId] = Vector.fill(seatCount)(UUID.randomUUID())
    val clients: Vector[Client] = Vector.fill(clientCount)(Client(UUID.randomUUID(), UUID.randomUUID()))

    private val seats: Map[SeatId, ActorRef] =
      seatIds.map(seatId => seatId -> system.actorOf(FakeSeatActor.props(seatId))).toMap

    private val sessionManager: ActorRef =
      system.actorOf(FakeSessionManager.props(clients.map(client => client.sessionId -> client.clientId).toMap))

    private val seatAllocator: ActorRef =
      system.actorOf(SeatAllocator.props(responseTimeout = 500.millis))

    private val resolver = new SeatRefResolver {
      override def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef] =
        seats.filter { case (seatId, _) => seatIds.contains(seatId) }
    }

    val handler: ActorRef =
      system.actorOf(
        ReservationHandler.props(
          sessionManager = sessionManager,
          seatAllocator = seatAllocator,
          seatRefResolver = resolver,
          reservationTtl = reservationTtl,
          responseTimeout = 500.millis
        )
      )

    def reserveSeats(client: Client, seatIds: Set[SeatId]): ReserveSeats =
      ReserveSeats(matchId = matchId, zone = VIP, seatIds = seatIds, sessionId = client.sessionId)

    def statusOf(seatId: SeatId): SeatStatus = {
      val probe = TestProbe()
      probe.send(seats(seatId), GetSeatStatus)
      probe.expectMsgType[SeatStatusResponse].status
    }
  }
}
