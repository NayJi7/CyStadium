package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, Cancellable, Props, ReceiveTimeout, Status}
import cystadium.actors.SeatAllocator.{AllocateSeats, AllocationFailed, AllocationSucceeded}
import cystadium.protocol._

import java.time.Instant
import java.util.UUID
import scala.concurrent.duration._

object ReservationHandler {
  def props(
      sessionManager: ActorRef,
      seatAllocator: ActorRef,
      paymentGateway: ActorRef,
      seatRefResolver: SeatRefResolver,
      repository: ReservationRepository = ReservationRepository.NoOp,
      reservationTtl: FiniteDuration = 10.minutes,
      responseTimeout: FiniteDuration = 5.seconds,
      pricing: Zone => Double = DefaultPricing.priceOf
  ): Props =
    Props(new ReservationHandler(sessionManager, seatAllocator, paymentGateway, seatRefResolver, repository, reservationTtl, responseTimeout, pricing))

  trait SeatRefResolver {
    def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef]
    def resolveAll(matchId: MatchId, seatIds: Set[SeatId]): (Map[SeatId, ActorRef], Map[SeatId, Zone])
  }

  final case class ReservationSnapshot(
      reservationId: ReservationId,
      bookingId: BookingId,
      clientId: ClientId,
      matchId: MatchId,
      zone: Zone,
      seatIds: Set[SeatId],
      total: Double,
      expiresAt: Instant,
      status: String
  )

  trait ReservationRepository {
    def createReservation(snapshot: ReservationSnapshot): Unit
    def markPaid(reservationId: ReservationId, transactionId: String): Unit
    def markPaymentFailed(reservationId: ReservationId, reason: String): Unit
    def markPaymentTimeout(reservationId: ReservationId): Unit
    def markConfirmed(reservationId: ReservationId, ticketCode: String): Unit
    def markCancelled(reservationId: ReservationId, reason: String): Unit
  }

  object ReservationRepository {
    object NoOp extends ReservationRepository {
      override def createReservation(snapshot: ReservationSnapshot): Unit = ()
      override def markPaid(reservationId: ReservationId, transactionId: String): Unit = ()
      override def markPaymentFailed(reservationId: ReservationId, reason: String): Unit = ()
      override def markPaymentTimeout(reservationId: ReservationId): Unit = ()
      override def markConfirmed(reservationId: ReservationId, ticketCode: String): Unit = ()
      override def markCancelled(reservationId: ReservationId, reason: String): Unit = ()
    }
  }

  object DefaultPricing {
    def priceOf(zone: Zone): Double =
      zone match {
        case VIP       => 500.0
        case Or        => 250.0
        case Standard  => 100.0
        case Populaire => 50.0
      }
  }

  private sealed trait ReservationStatus
  private case object Pending extends ReservationStatus
  private case object PaidStatus extends ReservationStatus
  private case object ConfirmedStatus extends ReservationStatus
  private case object CancelledStatus extends ReservationStatus

  private final case class ReservationRecord(
      reservationId: ReservationId,
      bookingId: BookingId,
      clientId: ClientId,
      matchId: MatchId,
      zone: Zone,
      seatRefs: Map[SeatId, ActorRef],
      total: Double,
      expiresAt: Instant,
      status: ReservationStatus,
      expirationTask: Option[Cancellable]
  )

  private final case class ReservationCreated(record: ReservationRecord, replyTo: ActorRef)
  private final case class ReservationCreationRejected(conflictingSeats: Set[SeatId], replyTo: ActorRef)
  private final case class ExpireReservation(reservationId: ReservationId)
  private final case class FinalizationSucceeded(reservationId: ReservationId, replyTo: ActorRef, action: FinalizationAction)
  private final case class FinalizationFailed(reservationId: ReservationId, replyTo: ActorRef, reason: String)

  private sealed trait FinalizationAction
  private case object ConfirmAction extends FinalizationAction
  private final case class ReleaseAction(reason: String) extends FinalizationAction

  private object ReservationCreationSession {
    def props(
        request: ReserveSeats,
        replyTo: ActorRef,
        parent: ActorRef,
        sessionManager: ActorRef,
        seatAllocator: ActorRef,
        seatRefResolver: SeatRefResolver,
        reservationTtl: FiniteDuration,
        responseTimeout: FiniteDuration,
        pricing: Zone => Double
    ): Props =
      Props(
        new ReservationCreationSession(
          request,
          replyTo,
          parent,
          sessionManager,
          seatAllocator,
          seatRefResolver,
          reservationTtl,
          responseTimeout,
          pricing
        )
      )
  }

  private final class ReservationCreationSession(
      request: ReserveSeats,
      replyTo: ActorRef,
      parent: ActorRef,
      sessionManager: ActorRef,
      seatAllocator: ActorRef,
      seatRefResolver: SeatRefResolver,
      reservationTtl: FiniteDuration,
      responseTimeout: FiniteDuration,
      pricing: Zone => Double
  ) extends Actor
      with ActorLogging {

    private val reservationId = UUID.randomUUID()
    private val bookingId = UUID.randomUUID()
    private val expiresAt = Instant.now().plusMillis(reservationTtl.toMillis)
    private var clientId: Option[ClientId] = None
    private var resolvedSeatRefs: Map[SeatId, ActorRef] = Map.empty
    private var seatZones: Map[SeatId, Zone] = Map.empty

    override def preStart(): Unit = {
      context.setReceiveTimeout(responseTimeout)
      sessionManager ! ValidateSession(request.sessionId)
    }

    override def receive: Receive = validatingSession

    private def validatingSession: Receive = {
      case SessionValid(validClientId) =>
        clientId = Some(validClientId)
        val (refs, zones) = seatRefResolver.resolveAll(request.matchId, request.seatIds)
        resolvedSeatRefs = refs
        seatZones = zones

        val missingSeats = request.seatIds.diff(resolvedSeatRefs.keySet)
        if (request.seatIds.isEmpty || missingSeats.nonEmpty) {
          parent ! ReservationCreationRejected(missingSeats, replyTo)
          context.stop(self)
        } else {
          seatAllocator ! AllocateSeats(
            matchId = request.matchId,
            zone = request.zone,
            clientId = validClientId,
            bookingId = bookingId,
            seatRefs = resolvedSeatRefs,
            deadline = expiresAt
          )
          context.become(allocatingSeats)
        }

      case SessionInvalid | SessionExpired(_) =>
        parent ! ReservationCreationRejected(Set.empty, replyTo)
        context.stop(self)

      case ReceiveTimeout =>
        parent ! ReservationCreationRejected(Set.empty, replyTo)
        context.stop(self)
    }

    private def allocatingSeats: Receive = {
      case AllocationSucceeded(_, _, succeededBookingId, seatIds) if succeededBookingId == bookingId =>
        val total = seatIds.toList.map { id =>
          pricing(seatZones.getOrElse(id, request.zone))
        }.sum
        val record = ReservationRecord(
          reservationId = reservationId,
          bookingId = bookingId,
          clientId = clientId.get,
          matchId = request.matchId,
          zone = request.zone,
          seatRefs = resolvedSeatRefs.filter { case (seatId, _) => seatIds.contains(seatId) },
          total = total,
          expiresAt = expiresAt,
          status = Pending,
          expirationTask = None
        )
        parent ! ReservationCreated(record, replyTo)
        context.stop(self)

      case AllocationFailed(_, _, failedBookingId, conflictingSeats, _) if failedBookingId == bookingId =>
        parent ! ReservationCreationRejected(conflictingSeats, replyTo)
        context.stop(self)

      case ReceiveTimeout =>
        parent ! ReservationCreationRejected(request.seatIds, replyTo)
        context.stop(self)
    }
  }

  private object ReservationFinalizationSession {
    def props(
        reservationId: ReservationId,
        bookingId: BookingId,
        seatRefs: Map[SeatId, ActorRef],
        replyTo: ActorRef,
        parent: ActorRef,
        action: FinalizationAction,
        responseTimeout: FiniteDuration
    ): Props =
      Props(new ReservationFinalizationSession(reservationId, bookingId, seatRefs, replyTo, parent, action, responseTimeout))
  }

  private final class ReservationFinalizationSession(
      reservationId: ReservationId,
      bookingId: BookingId,
      seatRefs: Map[SeatId, ActorRef],
      replyTo: ActorRef,
      parent: ActorRef,
      action: FinalizationAction,
      responseTimeout: FiniteDuration
  ) extends Actor
      with ActorLogging {

    private var pending: Set[SeatId] = seatRefs.keySet

    override def preStart(): Unit = {
      context.setReceiveTimeout(responseTimeout)

      action match {
        case ConfirmAction => seatRefs.values.foreach(_ ! ConfirmSeat(bookingId))
        case ReleaseAction(_) => seatRefs.values.foreach(_ ! ReleaseSeat(bookingId))
      }

      if (pending.isEmpty) {
        parent ! FinalizationSucceeded(reservationId, replyTo, action)
        context.stop(self)
      }
    }

    override def receive: Receive = {
      case SeatConfirmedOk(seatId) if action == ConfirmAction && pending.contains(seatId) =>
        pending -= seatId
        completeIfReady()

      case SeatReleasedOk(seatId) if action.isInstanceOf[ReleaseAction] && pending.contains(seatId) =>
        pending -= seatId
        completeIfReady()

      case ReceiveTimeout =>
        parent ! FinalizationFailed(reservationId, replyTo, "seat-finalization-timeout")
        context.stop(self)
    }

    private def completeIfReady(): Unit =
      if (pending.isEmpty) {
        parent ! FinalizationSucceeded(reservationId, replyTo, action)
        context.stop(self)
      }
  }
}

final class ReservationHandler(
    sessionManager: ActorRef,
    seatAllocator: ActorRef,
    paymentGateway: ActorRef,
    seatRefResolver: ReservationHandler.SeatRefResolver,
    repository: ReservationHandler.ReservationRepository,
    reservationTtl: FiniteDuration,
    responseTimeout: FiniteDuration,
    pricing: Zone => Double
) extends Actor
    with ActorLogging {

  import ReservationHandler._
  import context.dispatcher

  private var reservations: Map[ReservationId, ReservationRecord] = Map.empty

  private var paymentWaiters: Map[ReservationId, ActorRef] = Map.empty

  override def receive: Receive = {
    case request: ReserveSeats =>
      context.actorOf(
        ReservationCreationSession.props(
          request = request,
          replyTo = sender(),
          parent = self,
          sessionManager = sessionManager,
          seatAllocator = seatAllocator,
          seatRefResolver = seatRefResolver,
          reservationTtl = reservationTtl,
          responseTimeout = responseTimeout,
          pricing = pricing
        )
      )

    case ReservationCreated(record, replyTo) =>
      val expirationTask = context.system.scheduler.scheduleOnce(reservationTtl, self, ExpireReservation(record.reservationId))
      val persistedRecord = record.copy(expirationTask = Some(expirationTask))
      repository.createReservation(snapshotOf(persistedRecord))
      reservations += record.reservationId -> persistedRecord
      replyTo ! SeatsReserved(record.reservationId, record.seatRefs.keySet, record.total, record.expiresAt)

    case ReservationCreationRejected(conflictingSeats, replyTo) =>
      replyTo ! SeatsUnavailable(conflictingSeats)

    case ConfirmReservation(reservationId) =>
      reservations.get(reservationId) match {
        case Some(record) if record.status == Pending || record.status == PaidStatus =>
          startFinalization(reservationId, record, sender(), ConfirmAction)

        case Some(record) if record.status == ConfirmedStatus =>
          sender() ! ReservationConfirmed(reservationId, ticketCode(reservationId))

        case Some(_) =>
          sender() ! Status.Failure(new IllegalStateException(s"Reservation $reservationId cannot be confirmed"))

        case None =>
          sender() ! Status.Failure(new NoSuchElementException(s"Reservation $reservationId not found"))
      }

    case CancelReservation(reservationId, reason) =>
      reservations.get(reservationId) match {
        case Some(record) if record.status == Pending || record.status == PaidStatus =>
          startFinalization(reservationId, record, sender(), ReleaseAction(reason))

        case Some(record) if record.status == CancelledStatus =>
          sender() ! SeatsReleased(reservationId)

        case Some(_) =>
          sender() ! Status.Failure(new IllegalStateException(s"Reservation $reservationId cannot be cancelled"))

        case None =>
          sender() ! Status.Failure(new NoSuchElementException(s"Reservation $reservationId not found"))
      }

    case InitPayment(reservationId, amount) =>
      log.info(s"[DEBUG] InitPayment: id=$reservationId amount=$amount known=${reservations.keySet.take(5)} statuses=${reservations.mapValues(_.status).take(5)}")
      reservations.get(reservationId) match {
        case Some(record) if record.status == Pending =>
          paymentWaiters += reservationId -> sender()
          paymentGateway ! InitPayment(reservationId, amount)
        case Some(record) =>
          log.warning(s"[DEBUG] InitPayment rejected: $reservationId status=${record.status}")
          sender() ! Status.Failure(new IllegalStateException(s"Reservation $reservationId cannot be paid"))
        case None =>
          log.warning(s"[DEBUG] InitPayment not found: $reservationId")
          sender() ! Status.Failure(new NoSuchElementException(s"Reservation $reservationId not found"))
      }

    case PaymentSuccess(reservationId, transactionId) =>
      val waiter = paymentWaiters.get(reservationId)
      reservations.get(reservationId).filter(_.status == Pending).foreach { record =>
        repository.markPaid(reservationId, transactionId)
        reservations += reservationId -> record.copy(status = PaidStatus)
        startFinalization(reservationId, record, context.system.deadLetters, ConfirmAction)
      }
      // Reply to HTTP route immediately
      waiter.foreach(_ ! PaymentSuccess(reservationId, transactionId))
      paymentWaiters -= reservationId

    case PaymentFailed(reservationId, reason) =>
      val waiter = paymentWaiters.get(reservationId)
      reservations.get(reservationId).filter(r => r.status == Pending || r.status == PaidStatus).foreach { record =>
        repository.markPaymentFailed(reservationId, reason)
        startFinalization(reservationId, record, context.system.deadLetters, ReleaseAction("payment-failed"))
      }
      waiter.foreach(_ ! PaymentFailed(reservationId, reason))
      paymentWaiters -= reservationId

    case PaymentTimeout(reservationId) =>
      val waiter = paymentWaiters.get(reservationId)
      reservations.get(reservationId).filter(r => r.status == Pending || r.status == PaidStatus).foreach { record =>
        repository.markPaymentTimeout(reservationId)
        startFinalization(reservationId, record, context.system.deadLetters, ReleaseAction("payment-timeout"))
      }
      waiter.foreach(_ ! PaymentTimeout(reservationId))
      paymentWaiters -= reservationId

    case ExpireReservation(reservationId) =>
      reservations.get(reservationId).filter(_.status == Pending).foreach { record =>
        startFinalization(reservationId, record, context.system.deadLetters, ReleaseAction("reservation-expired"))
      }

    case FinalizationSucceeded(reservationId, replyTo, ConfirmAction) =>
      val code = ticketCode(reservationId)
      reservations.get(reservationId).foreach { record =>
        record.expirationTask.foreach(_.cancel())
        repository.markConfirmed(reservationId, code)
        reservations += reservationId -> record.copy(status = ConfirmedStatus, expirationTask = None)
      }
      replyTo ! ReservationConfirmed(reservationId, code)

    case FinalizationSucceeded(reservationId, replyTo, ReleaseAction(reason)) =>
      reservations.get(reservationId).foreach { record =>
        record.expirationTask.foreach(_.cancel())
        repository.markCancelled(reservationId, reason)
        reservations += reservationId -> record.copy(status = CancelledStatus, expirationTask = None)
      }
      if (replyTo != context.system.deadLetters) {
        replyTo ! SeatsReleased(reservationId)
      }

    case FinalizationFailed(reservationId, replyTo, reason) =>
      replyTo ! Status.Failure(new RuntimeException(s"Reservation $reservationId finalization failed: $reason"))
  }

  private def ticketCode(reservationId: ReservationId): String =
    s"TICKET-${reservationId.toString.take(8).toUpperCase}"

  private def snapshotOf(record: ReservationRecord): ReservationSnapshot =
    ReservationSnapshot(
      reservationId = record.reservationId,
      bookingId = record.bookingId,
      clientId = record.clientId,
      matchId = record.matchId,
      zone = record.zone,
      seatIds = record.seatRefs.keySet,
      total = record.total,
      expiresAt = record.expiresAt,
      status = record.status.toString
    )

  private def startFinalization(
      reservationId: ReservationId,
      record: ReservationRecord,
      replyTo: ActorRef,
      action: FinalizationAction
  ): Unit =
    context.actorOf(
      ReservationFinalizationSession.props(
        reservationId = reservationId,
        bookingId = record.bookingId,
        seatRefs = record.seatRefs,
        replyTo = replyTo,
        parent = self,
        action = action,
        responseTimeout = responseTimeout
      )
    )
}
