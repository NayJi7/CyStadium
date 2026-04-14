package cystadium.protocol

import java.time.Instant

// ─────────────────────────────────────────────────────────────────────────────
// FICHIER COLLECTIF — propriété du groupe entier
// Toute modification = PR + validation des 3 équipes (label : breaking-contract)
// ─────────────────────────────────────────────────────────────────────────────

// ── Zones tarifaires ──────────────────────────────────────────────────────────
sealed trait Zone
case object VIP       extends Zone
case object Or        extends Zone
case object Standard  extends Zone
case object Populaire extends Zone

// ── Statuts d'un siège ────────────────────────────────────────────────────────
sealed trait SeatStatus
case object Free extends SeatStatus
case class  Reserved(clientId: ClientId, bookingId: BookingId, deadline: Instant) extends SeatStatus
case class  Confirmed(clientId: ClientId, bookingId: BookingId) extends SeatStatus
case object Locked extends SeatStatus

// ── Auth — SessionManager (Adam) ──────────────────────────────────────────────
case class Login(clientId: ClientId)
case class LoginSuccess(sessionId: SessionId)
case class Logout(sessionId: SessionId)
case class ValidateSession(sessionId: SessionId)
case class SessionValid(clientId: ClientId)
case object SessionInvalid
case class SessionExpired(sessionId: SessionId)

// ── Disponibilité — MatchManager → ZoneManager → SeatActor (Eléonore/Inès) ───
case class CheckAvailability(matchId: MatchId)
case class AvailabilityResult(matchId: MatchId, zones: Map[Zone, Int]) // Int = nb sièges libres

// ── Siège individuel — SeatActor ↔ SeatAllocator ─────────────────────────────
// SeatActor répond à SeatAllocator (Fatima/Abdel)
// SeatActor publie SeatStatusEvent sur l'EventStream à chaque changement d'état

case class ReserveSeat(clientId: ClientId, bookingId: BookingId, deadline: Instant)
case class SeatReservedOk(seatId: SeatId)
case class SeatUnavailable(seatId: SeatId, currentStatus: SeatStatus)

case class ConfirmSeat(bookingId: BookingId)
case class SeatConfirmedOk(seatId: SeatId)

case class ReleaseSeat(bookingId: BookingId)
case class SeatReleasedOk(seatId: SeatId)

case object GetSeatStatus
case class SeatStatusResponse(seatId: SeatId, status: SeatStatus)

// ── Réservation multi-sièges — ReservationHandler ↔ SeatAllocator (Fatima/Abdel)
case class ReserveSeats(matchId: MatchId, zone: Zone, seatIds: Set[SeatId], sessionId: SessionId)
case class SeatsReserved(reservationId: ReservationId, seatIds: Set[SeatId], total: Double, expiresAt: Instant)
case class SeatsUnavailable(conflictingSeats: Set[SeatId])
case class SeatsReleased(reservationId: ReservationId)

// ── Paiement — PaymentGateway (Fatima/Abdel) ──────────────────────────────────
case class InitPayment(reservationId: ReservationId, amount: Double)
case class PaymentSuccess(reservationId: ReservationId, transactionId: String)
case class PaymentFailed(reservationId: ReservationId, reason: String)
case class PaymentTimeout(reservationId: ReservationId)

// ── Confirmation / Annulation ─────────────────────────────────────────────────
case class ConfirmReservation(reservationId: ReservationId)
case class CancelReservation(reservationId: ReservationId, reason: String)
case class ReservationConfirmed(reservationId: ReservationId, ticketCode: String)

// ── Événement WebSocket — publié par SeatActor, consommé par Adam ─────────────
// SeatActor : context.system.eventStream.publish(SeatStatusEvent(...))
// Adam      : system.eventStream.subscribe(wsActor, classOf[SeatStatusEvent])
case class SeatStatusEvent(matchId: MatchId, seatId: SeatId, status: SeatStatus)
