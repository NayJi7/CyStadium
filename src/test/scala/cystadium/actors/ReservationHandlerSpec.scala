package cystadium.actors

import akka.actor.{ActorRef, ActorSystem}
import akka.testkit.{TestKit, TestProbe}
import com.typesafe.config.ConfigFactory
import cystadium.actors.ReservationHandler.SeatRefResolver
import cystadium.actors.SeatAllocator.{AllocateSeats, AllocationFailed, AllocationSucceeded}
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.util.UUID
import scala.concurrent.duration._

private object ReservationHandlerSpec {
  final case class CreatedReservation(reservationId: ReservationId, bookingId: BookingId)
}

final class ReservationHandlerSpec
    extends TestKit(ActorSystem("ReservationHandlerSpec", ConfigFactory.parseString("akka.loglevel = WARNING")))
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll {

  import ReservationHandlerSpec._

  override def afterAll(): Unit =
    TestKit.shutdownActorSystem(system)

  "ReservationHandler" should {
    "reserve seats after validating the session and a successful allocation" in {
      val fixture = new Fixture
      val handler = fixture.handler()
      val requester = TestProbe()
      val request = fixture.reserveSeatsRequest()

      requester.send(handler, request)

      fixture.sessionManager.expectMsg(ValidateSession(request.sessionId))
      fixture.sessionManager.reply(SessionValid(fixture.clientId))

      val allocation = fixture.seatAllocator.expectMsgType[AllocateSeats]
      allocation.matchId shouldBe request.matchId
      allocation.zone shouldBe request.zone
      allocation.clientId shouldBe fixture.clientId
      allocation.seatRefs.keySet shouldBe request.seatIds

      fixture.seatAllocator.reply(
        AllocationSucceeded(
          matchId = request.matchId,
          zone = request.zone,
          bookingId = allocation.bookingId,
          seatIds = request.seatIds
        )
      )

      val response = requester.expectMsgType[SeatsReserved]
      response.seatIds shouldBe request.seatIds
      response.total shouldBe 1000.0
      response.expiresAt shouldBe allocation.deadline
    }

    "reject a reservation when the session is invalid" in {
      val fixture = new Fixture
      val handler = fixture.handler()
      val requester = TestProbe()
      val request = fixture.reserveSeatsRequest()

      requester.send(handler, request)

      fixture.sessionManager.expectMsg(ValidateSession(request.sessionId))
      fixture.sessionManager.reply(SessionInvalid)

      requester.expectMsg(SeatsUnavailable(Set.empty))
      fixture.seatAllocator.expectNoMessage(200.millis)
    }

    "return unavailable seats when allocation fails" in {
      val fixture = new Fixture
      val handler = fixture.handler()
      val requester = TestProbe()
      val request = fixture.reserveSeatsRequest()

      requester.send(handler, request)

      fixture.sessionManager.expectMsg(ValidateSession(request.sessionId))
      fixture.sessionManager.reply(SessionValid(fixture.clientId))

      val allocation = fixture.seatAllocator.expectMsgType[AllocateSeats]
      val conflictingSeat = request.seatIds.head
      fixture.seatAllocator.reply(
        AllocationFailed(
          matchId = request.matchId,
          zone = request.zone,
          bookingId = allocation.bookingId,
          conflictingSeats = Set(conflictingSeat),
          reason = "seat-unavailable"
        )
      )

      requester.expectMsg(SeatsUnavailable(Set(conflictingSeat)))
    }

    "confirm a pending reservation by confirming every reserved seat" in {
      val fixture = new Fixture
      val handler = fixture.handler()
      val requester = TestProbe()
      val request = fixture.reserveSeatsRequest()
      val reserved = fixture.createReservation(handler, requester, request)

      requester.send(handler, ConfirmReservation(reserved.reservationId))

      fixture.seatA.expectMsg(ConfirmSeat(reserved.bookingId))
      fixture.seatB.expectMsg(ConfirmSeat(reserved.bookingId))

      fixture.seatA.reply(SeatConfirmedOk(fixture.seatAId))
      fixture.seatB.reply(SeatConfirmedOk(fixture.seatBId))

      val confirmed = requester.expectMsgType[ReservationConfirmed]
      confirmed.reservationId shouldBe reserved.reservationId
      confirmed.ticketCode should startWith("TICKET-")
    }

    "cancel a pending reservation by releasing every reserved seat" in {
      val fixture = new Fixture
      val handler = fixture.handler()
      val requester = TestProbe()
      val request = fixture.reserveSeatsRequest()
      val reserved = fixture.createReservation(handler, requester, request)

      requester.send(handler, CancelReservation(reserved.reservationId, "user-cancelled"))

      fixture.seatA.expectMsg(ReleaseSeat(reserved.bookingId))
      fixture.seatB.expectMsg(ReleaseSeat(reserved.bookingId))

      fixture.seatA.reply(SeatReleasedOk(fixture.seatAId))
      fixture.seatB.reply(SeatReleasedOk(fixture.seatBId))

      requester.expectMsg(SeatsReleased(reserved.reservationId))
    }
  }

  private final class Fixture {
    val sessionManager: TestProbe = TestProbe()
    val seatAllocator: TestProbe = TestProbe()
    val seatA: TestProbe = TestProbe()
    val seatB: TestProbe = TestProbe()

    val clientId: ClientId = UUID.randomUUID()
    val matchId: MatchId = UUID.randomUUID()
    val sessionId: SessionId = UUID.randomUUID()
    val seatAId: SeatId = UUID.randomUUID()
    val seatBId: SeatId = UUID.randomUUID()

    private val resolver = new SeatRefResolver {
      override def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef] =
        Map(seatAId -> seatA.ref, seatBId -> seatB.ref).filter { case (seatId, _) => seatIds.contains(seatId) }
    }

    def handler(): ActorRef =
      system.actorOf(
        ReservationHandler.props(
          sessionManager = sessionManager.ref,
          seatAllocator = seatAllocator.ref,
          seatRefResolver = resolver,
          reservationTtl = 10.minutes,
          responseTimeout = 500.millis
        )
      )

    def reserveSeatsRequest(): ReserveSeats =
      ReserveSeats(
        matchId = matchId,
        zone = VIP,
        seatIds = Set(seatAId, seatBId),
        sessionId = sessionId
      )

    def createReservation(handler: ActorRef, requester: TestProbe, request: ReserveSeats): CreatedReservation = {
      requester.send(handler, request)

      sessionManager.expectMsg(ValidateSession(request.sessionId))
      sessionManager.reply(SessionValid(clientId))

      val allocation = seatAllocator.expectMsgType[AllocateSeats]
      seatAllocator.reply(
        AllocationSucceeded(
          matchId = request.matchId,
          zone = request.zone,
          bookingId = allocation.bookingId,
          seatIds = request.seatIds
        )
      )

      val reserved = requester.expectMsgType[SeatsReserved]
      CreatedReservation(reserved.reservationId, allocation.bookingId)
    }
  }
}
