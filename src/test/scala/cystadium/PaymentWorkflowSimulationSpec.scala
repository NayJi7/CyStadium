package cystadium

import akka.actor.{Actor, ActorRef, ActorSystem, Props}
import akka.testkit.{TestKit, TestProbe}
import com.typesafe.config.ConfigFactory
import cystadium.actors.PaymentGateway
import cystadium.actors.ReservationHandler.SeatRefResolver
import cystadium.actors.{ReservationHandler, SeatAllocator}
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.util.UUID
import scala.concurrent.duration._

object PaymentWorkflowSimulationSpec {
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
    def props(seatId: SeatId): Props = Props(new FakeSeatActor(seatId))
  }
}

final class PaymentWorkflowSimulationSpec
    extends TestKit(ActorSystem("PaymentWorkflowSimulationSpec", ConfigFactory.parseString("akka.loglevel = WARNING")))
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll {

  import PaymentWorkflowSimulationSpec._

  override def afterAll(): Unit =
    TestKit.shutdownActorSystem(system)

  "Reservation + payment workflow" should {
    "S1 confirm reservation when payment succeeds" in {
      val fixture = new Fixture(() => PaymentGateway.Success, reservationTtl = 1.second, paymentTimeout = 200.millis)
      val requester = TestProbe()
      val seatId = fixture.seatId

      requester.send(fixture.handler, fixture.reserveSeats)
      val reserved = requester.expectMsgType[SeatsReserved]

      requester.send(fixture.paymentGateway, InitPayment(reserved.reservationId, reserved.total))
      val payment = requester.expectMsgType[PaymentSuccess]
      requester.send(fixture.handler, payment)
      awaitAssert({
        fixture.statusOf(seatId) shouldBe a[Confirmed]
      }, 1.second, 50.millis)
    }

    "S2 cancel reservation when payment fails" in {
      val fixture = new Fixture(() => PaymentGateway.Failed, reservationTtl = 1.second, paymentTimeout = 200.millis)
      val requester = TestProbe()
      val seatId = fixture.seatId

      requester.send(fixture.handler, fixture.reserveSeats)
      val reserved = requester.expectMsgType[SeatsReserved]

      requester.send(fixture.paymentGateway, InitPayment(reserved.reservationId, reserved.total))
      val payment = requester.expectMsgType[PaymentFailed]
      requester.send(fixture.handler, payment)
      awaitAssert({
        fixture.statusOf(seatId) shouldBe Free
      }, 1.second, 50.millis)
    }

    "S3 release reservation automatically after timeout outcome" in {
      val fixture = new Fixture(() => PaymentGateway.Timeout, reservationTtl = 500.millis, paymentTimeout = 100.millis)
      val requester = TestProbe()
      val seatId = fixture.seatId

      requester.send(fixture.handler, fixture.reserveSeats)
      val reserved = requester.expectMsgType[SeatsReserved]

      requester.send(fixture.paymentGateway, InitPayment(reserved.reservationId, reserved.total))
      val payment = requester.expectMsg(PaymentTimeout(reserved.reservationId))
      requester.send(fixture.handler, payment)

      awaitAssert({
        fixture.statusOf(seatId) shouldBe Free
      }, 1500.millis, 50.millis)
    }
  }

  private final class Fixture(
      outcomePicker: () => PaymentGateway.PaymentOutcome,
      reservationTtl: FiniteDuration,
      paymentTimeout: FiniteDuration
  ) {
    val matchId: MatchId = UUID.randomUUID()
    val seatId: SeatId = UUID.randomUUID()
    val clientId: ClientId = UUID.randomUUID()
    val sessionId: SessionId = UUID.randomUUID()

    private val seat: ActorRef = system.actorOf(FakeSeatActor.props(seatId))
    private val sessionManager: ActorRef =
      system.actorOf(FakeSessionManager.props(Map(sessionId -> clientId)))

    private val seatAllocator: ActorRef =
      system.actorOf(SeatAllocator.props(responseTimeout = 500.millis))

    val paymentGateway: ActorRef =
      system.actorOf(
        PaymentGateway.props(
          paymentTimeout = paymentTimeout,
          successDelay = 50.millis,
          failedDelay = 50.millis,
          outcomePicker = outcomePicker
        )
      )

    private val resolver = new SeatRefResolver {
      override def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef] =
        if (seatIds.contains(seatId)) Map(seatId -> seat) else Map.empty
      override def resolveAll(matchId: MatchId, seatIds: Set[SeatId]): (Map[SeatId, ActorRef], Map[SeatId, Zone]) =
        (resolve(matchId, VIP, seatIds), seatIds.map(_ -> VIP).toMap)
    }

    val handler: ActorRef =
      system.actorOf(
        ReservationHandler.props(
          sessionManager = sessionManager,
          seatAllocator = seatAllocator,
          paymentGateway = paymentGateway,
          seatRefResolver = resolver,
          reservationTtl = reservationTtl,
          responseTimeout = 500.millis
        )
      )

    val reserveSeats: ReserveSeats =
      ReserveSeats(matchId = matchId, zone = VIP, seatIds = Set(seatId), sessionId = sessionId)

    def statusOf(id: SeatId): SeatStatus = {
      val probe = TestProbe()
      probe.send(seat, GetSeatStatus)
      probe.expectMsgType[SeatStatusResponse].status
    }
  }
}
