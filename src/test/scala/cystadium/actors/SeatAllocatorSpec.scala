package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{TestKit, TestProbe}
import com.typesafe.config.ConfigFactory
import cystadium.actors.SeatAllocator._
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.time.Instant
import java.util.UUID
import scala.concurrent.duration._

final class SeatAllocatorSpec
    extends TestKit(ActorSystem("SeatAllocatorSpec", ConfigFactory.parseString("akka.loglevel = WARNING")))
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll {

  override def afterAll(): Unit =
    TestKit.shutdownActorSystem(system)

  "SeatAllocator" should {
    "accept an allocation only when every seat is reserved" in {
      val allocator = system.actorOf(SeatAllocator.props(500.millis))
      val requester = TestProbe()
      val seatA = UUID.randomUUID()
      val seatB = UUID.randomUUID()
      val seatAActor = TestProbe()
      val seatBActor = TestProbe()
      val clientId = UUID.randomUUID()
      val bookingId = UUID.randomUUID()
      val deadline = Instant.now().plusSeconds(600)
      val matchId = UUID.randomUUID()

      requester.send(
        allocator,
        AllocateSeats(
          matchId = matchId,
          zone = VIP,
          clientId = clientId,
          bookingId = bookingId,
          seatRefs = Map(seatA -> seatAActor.ref, seatB -> seatBActor.ref),
          deadline = deadline
        )
      )

      seatAActor.expectMsg(ReserveSeat(clientId, bookingId, deadline))
      seatBActor.expectMsg(ReserveSeat(clientId, bookingId, deadline))

      seatAActor.reply(SeatReservedOk(seatA))
      seatBActor.reply(SeatReservedOk(seatB))

      requester.expectMsg(AllocationSucceeded(matchId, VIP, bookingId, Set(seatA, seatB)))
    }

    "rollback already reserved seats when one seat is unavailable" in {
      val allocator = system.actorOf(SeatAllocator.props(500.millis))
      val requester = TestProbe()
      val seatA = UUID.randomUUID()
      val seatB = UUID.randomUUID()
      val seatAActor = TestProbe()
      val seatBActor = TestProbe()
      val bookingId = UUID.randomUUID()
      val matchId = UUID.randomUUID()

      requester.send(
        allocator,
        AllocateSeats(
          matchId = matchId,
          zone = Or,
          clientId = UUID.randomUUID(),
          bookingId = bookingId,
          seatRefs = Map(seatA -> seatAActor.ref, seatB -> seatBActor.ref),
          deadline = Instant.now().plusSeconds(600)
        )
      )

      seatAActor.expectMsgType[ReserveSeat]
      seatBActor.expectMsgType[ReserveSeat]

      seatAActor.reply(SeatReservedOk(seatA))
      seatBActor.reply(SeatUnavailable(seatB, Reserved(UUID.randomUUID(), UUID.randomUUID(), Instant.now())))

      seatAActor.expectMsg(ReleaseSeat(bookingId))
      seatAActor.reply(SeatReleasedOk(seatA))

      val failure = requester.expectMsgType[AllocationFailed]
      failure.matchId shouldBe matchId
      failure.zone shouldBe Or
      failure.bookingId shouldBe bookingId
      failure.conflictingSeats shouldBe Set(seatB)
    }

    "rollback seats that answer reserved after a conflict was already detected" in {
      val allocator = system.actorOf(SeatAllocator.props(500.millis))
      val requester = TestProbe()
      val seatA = UUID.randomUUID()
      val seatB = UUID.randomUUID()
      val seatAActor = TestProbe()
      val seatBActor = TestProbe()
      val bookingId = UUID.randomUUID()
      val matchId = UUID.randomUUID()

      requester.send(
        allocator,
        AllocateSeats(
          matchId = matchId,
          zone = Standard,
          clientId = UUID.randomUUID(),
          bookingId = bookingId,
          seatRefs = Map(seatA -> seatAActor.ref, seatB -> seatBActor.ref),
          deadline = Instant.now().plusSeconds(600)
        )
      )

      seatAActor.expectMsgType[ReserveSeat]
      seatBActor.expectMsgType[ReserveSeat]

      seatBActor.reply(SeatUnavailable(seatB, Locked))
      seatAActor.reply(SeatReservedOk(seatA))

      seatAActor.expectMsg(ReleaseSeat(bookingId))
      seatAActor.reply(SeatReleasedOk(seatA))

      val failure = requester.expectMsgType[AllocationFailed]
      failure.matchId shouldBe matchId
      failure.zone shouldBe Standard
      failure.bookingId shouldBe bookingId
      failure.conflictingSeats shouldBe Set(seatB)
    }

    "reject an empty seat selection" in {
      val allocator = system.actorOf(SeatAllocator.props(500.millis))
      val requester = TestProbe()
      val bookingId = UUID.randomUUID()
      val matchId = UUID.randomUUID()

      requester.send(
        allocator,
        AllocateSeats(
          matchId = matchId,
          zone = Populaire,
          clientId = UUID.randomUUID(),
          bookingId = bookingId,
          seatRefs = Map.empty,
          deadline = Instant.now().plusSeconds(600)
        )
      )

      val failure = requester.expectMsgType[AllocationFailed]
      failure.matchId shouldBe matchId
      failure.zone shouldBe Populaire
      failure.bookingId shouldBe bookingId
      failure.conflictingSeats shouldBe empty
      failure.reason shouldBe "empty-seat-selection"
    }
  }
}
