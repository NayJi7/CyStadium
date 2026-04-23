package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, Props, ReceiveTimeout}
import cystadium.protocol._

import scala.concurrent.duration._

object SeatAllocator {
  def props(responseTimeout: FiniteDuration = 5.seconds): Props =
    Props(new SeatAllocator(responseTimeout))

  final case class AllocateSeats(
      matchId: MatchId,
      zone: Zone,
      clientId: ClientId,
      bookingId: BookingId,
      seatRefs: Map[SeatId, ActorRef],
      deadline: java.time.Instant
  )

  final case class AllocationSucceeded(
      matchId: MatchId,
      zone: Zone,
      bookingId: BookingId,
      seatIds: Set[SeatId]
  )

  final case class AllocationFailed(
      matchId: MatchId,
      zone: Zone,
      bookingId: BookingId,
      conflictingSeats: Set[SeatId],
      reason: String
  )

  private object AllocationSession {
    def props(
        request: AllocateSeats,
        replyTo: ActorRef,
        responseTimeout: FiniteDuration
    ): Props =
      Props(new AllocationSession(request, replyTo, responseTimeout))
  }

  private final class AllocationSession(
      request: AllocateSeats,
      replyTo: ActorRef,
      responseTimeout: FiniteDuration
  ) extends Actor
      with ActorLogging {

    import request._

    private var pending: Set[SeatId] = seatRefs.keySet
    private var reserved: Set[SeatId] = Set.empty
    private var conflicts: Set[SeatId] = Set.empty
    private var rollbackPending: Set[SeatId] = Set.empty

    override def preStart(): Unit = {
      if (seatRefs.isEmpty) {
        replyTo ! AllocationFailed(matchId, zone, bookingId, Set.empty, "empty-seat-selection")
        context.stop(self)
      } else {
        context.setReceiveTimeout(responseTimeout)
        seatRefs.values.foreach(_ ! ReserveSeat(clientId, bookingId, deadline))
      }
    }

    override def receive: Receive = reserving

    private def reserving: Receive = {
      case SeatReservedOk(seatId) if pending.contains(seatId) =>
        pending -= seatId
        reserved += seatId
        completeIfReady()

      case SeatUnavailable(seatId, _) if pending.contains(seatId) =>
        pending -= seatId
        conflicts += seatId
        startRollback()

      case ReceiveTimeout =>
        val timedOut = pending
        conflicts ++= timedOut
        reserved ++= timedOut
        pending = Set.empty
        startRollback()
    }

    private def rollingBack: Receive = {
      case SeatReservedOk(seatId) if pending.contains(seatId) =>
        pending -= seatId
        rollbackPending += seatId
        seatRefs.get(seatId).foreach(_ ! ReleaseSeat(bookingId))

      case SeatUnavailable(seatId, _) if pending.contains(seatId) =>
        pending -= seatId
        conflicts += seatId
        completeRollbackIfReady()

      case SeatReleasedOk(seatId) if rollbackPending.contains(seatId) =>
        rollbackPending -= seatId
        completeRollbackIfReady()

      case ReceiveTimeout =>
        log.warning(
          "Rollback timed out for booking {}. Pending releases: {}",
          bookingId,
          rollbackPending.mkString(",")
        )
        pending.foreach { seatId =>
          seatRefs.get(seatId).foreach(_ ! ReleaseSeat(bookingId))
        }
        conflicts ++= pending
        pending = Set.empty
        finishFailure()
    }

    private def completeIfReady(): Unit =
      if (pending.isEmpty) {
        replyTo ! AllocationSucceeded(matchId, zone, bookingId, reserved)
        context.stop(self)
      }

    private def startRollback(): Unit = {
      rollbackPending ++= reserved
      rollbackPending.foreach { seatId =>
        seatRefs.get(seatId).foreach(_ ! ReleaseSeat(bookingId))
      }
      context.become(rollingBack)
      completeRollbackIfReady()
    }

    private def completeRollbackIfReady(): Unit =
      if (pending.isEmpty && rollbackPending.isEmpty) {
        finishFailure()
      }

    private def finishFailure(): Unit = {
      replyTo ! AllocationFailed(matchId, zone, bookingId, conflicts, "seat-unavailable")
      context.stop(self)
    }
  }
}

final class SeatAllocator(responseTimeout: FiniteDuration) extends Actor with ActorLogging {
  import SeatAllocator._

  override def receive: Receive = {
    case request: AllocateSeats =>
      context.actorOf(AllocationSession.props(request, sender(), responseTimeout))
  }
}
