package cystadium.db

import cystadium.actors.ReservationHandler
import cystadium.actors.ReservationHandler.ReservationSnapshot
import cystadium.protocol._
import slick.jdbc.PostgresProfile.api._

import java.time.Instant
import java.util.UUID
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.util.Try

class SlickReservationRepository(db: slick.jdbc.PostgresProfile.backend.Database)
    extends ReservationHandler.ReservationRepository {

  private def run[T](action: DBIO[T]): Unit =
    Try(Await.result(db.run(action), 5.seconds)).failed.foreach { ex =>
      Console.err.println(s"[SlickReservationRepository] DB error: ${ex.getMessage}")
    }

  override def createReservation(s: ReservationSnapshot): Unit = run {
    DBIO.seq(
      Tables.reservations += ReservationRow(
        id        = s.reservationId,
        clientId  = s.clientId,
        matchId   = s.matchId,
        status    = "pending",
        total     = BigDecimal(s.total),
        createdAt = Instant.now(),
        expiresAt = Some(s.expiresAt)
      ),
      Tables.reservationSeats ++= s.seatIds.map(sid => ReservationSeatRow(s.reservationId, sid)),
      Tables.payments += PaymentRow(
        id            = UUID.randomUUID(),
        reservationId = s.reservationId,
        amount        = BigDecimal(s.total),
        status        = "pending",
        createdAt     = Instant.now(),
        completedAt   = None
      )
    )
  }

  override def markPaid(reservationId: ReservationId, transactionId: String): Unit = run {
    DBIO.seq(
      Tables.reservations.filter(_.id === reservationId).map(_.status).update("paid"),
      Tables.payments.filter(_.reservationId === reservationId)
        .map(r => (r.status, r.completedAt)).update(("success", Some(Instant.now())))
    )
  }

  override def markPaymentFailed(reservationId: ReservationId, reason: String): Unit = run {
    DBIO.seq(
      Tables.reservations.filter(_.id === reservationId).map(_.status).update("cancelled"),
      Tables.payments.filter(_.reservationId === reservationId)
        .map(r => (r.status, r.completedAt)).update(("failed", Some(Instant.now())))
    )
  }

  override def markPaymentTimeout(reservationId: ReservationId): Unit = run {
    DBIO.seq(
      Tables.reservations.filter(_.id === reservationId).map(_.status).update("cancelled"),
      Tables.payments.filter(_.reservationId === reservationId)
        .map(r => (r.status, r.completedAt)).update(("timeout", Some(Instant.now())))
    )
  }

  override def markConfirmed(reservationId: ReservationId, ticketCode: String): Unit = run {
    DBIO.seq(
      Tables.reservations.filter(_.id === reservationId).map(_.status).update("confirmed"),
      Tables.seats
        .filter(_.id.in(Tables.reservationSeats.filter(_.reservationId === reservationId).map(_.seatId)))
        .map(_.status).update("confirmed")
    )
  }

  override def markCancelled(reservationId: ReservationId, reason: String): Unit = run {
    DBIO.seq(
      Tables.reservations.filter(_.id === reservationId).map(_.status).update("cancelled"),
      Tables.seats
        .filter(_.id.in(Tables.reservationSeats.filter(_.reservationId === reservationId).map(_.seatId)))
        .map(_.status).update("free")
    )
  }
}
