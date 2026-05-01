package cystadium.db

import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

import slick.jdbc.PostgresProfile.api._
import slick.lifted.ProvenShape

// ─────────────────────────────────────────────────────────────────────────────
// Mapping Slick de src/main/resources/db/migration/V1__init.sql
// Doit rester synchronisé avec le schéma. Toute modif → PR breaking-contract.
// ─────────────────────────────────────────────────────────────────────────────

// Classe de base commune : expose le mapping Instant ↔ Timestamp
// pour que column[Instant] résolve son TypedType implicite dans chaque Table.
abstract class CystadiumTable[T](tag: Tag, name: String) extends Table[T](tag, name) {
  implicit val instantColumnType: BaseColumnType[Instant] =
    MappedColumnType.base[Instant, Timestamp](Timestamp.from, _.toInstant)
}

// ── Rows ─────────────────────────────────────────────────────────────────────
final case class MatchRow(
  id: UUID, homeTeam: String, awayTeam: String,
  matchDate: Instant, stadium: String, status: String,
  city: Option[String], stage: Option[String], highlight: Boolean
)

final case class ZoneRow(
  id: UUID, matchId: UUID, name: String,
  price: BigDecimal, capacity: Int
)

final case class SeatRow(
  id: UUID, zoneId: UUID, label: String,
  row: String, number: Int, status: String
)

final case class ClientRow(
  id: UUID,
  email: String,
  name: String,
  username: String,
  passwordHash: Option[String],
  isAdmin: Boolean
)

final case class SessionRow(
  id: UUID, clientId: UUID, createdAt: Instant, expiresAt: Instant
)

final case class ReservationRow(
  id: UUID, clientId: UUID, matchId: UUID, status: String,
  total: BigDecimal, createdAt: Instant, expiresAt: Option[Instant]
)

final case class ReservationSeatRow(reservationId: UUID, seatId: UUID)

final case class PaymentRow(
  id: UUID, reservationId: UUID, amount: BigDecimal, status: String,
  createdAt: Instant, completedAt: Option[Instant]
)

// ── Tables ───────────────────────────────────────────────────────────────────
class Matches(tag: Tag) extends CystadiumTable[MatchRow](tag, "matches") {
  def id        = column[UUID]("id", O.PrimaryKey)
  def homeTeam  = column[String]("home_team")
  def awayTeam  = column[String]("away_team")
  def matchDate = column[Instant]("match_date")
  def stadium   = column[String]("stadium")
  def status    = column[String]("status")
  def city      = column[Option[String]]("city")
  def stage     = column[Option[String]]("stage")
  def highlight = column[Boolean]("highlight")
  def * : ProvenShape[MatchRow] =
    (id, homeTeam, awayTeam, matchDate, stadium, status, city, stage, highlight).mapTo[MatchRow]
}

class Zones(tag: Tag) extends CystadiumTable[ZoneRow](tag, "zones") {
  def id       = column[UUID]("id", O.PrimaryKey)
  def matchId  = column[UUID]("match_id")
  def name     = column[String]("name")
  def price    = column[BigDecimal]("price")
  def capacity = column[Int]("capacity")
  def matchFk  = foreignKey("zones_match_fk", matchId, Tables.matches)(_.id)
  def * : ProvenShape[ZoneRow] =
    (id, matchId, name, price, capacity).mapTo[ZoneRow]
}

class Seats(tag: Tag) extends CystadiumTable[SeatRow](tag, "seats") {
  def id     = column[UUID]("id", O.PrimaryKey)
  def zoneId = column[UUID]("zone_id")
  def label  = column[String]("label")
  def row    = column[String]("row")
  def number = column[Int]("number")
  def status = column[String]("status")
  def zoneFk = foreignKey("seats_zone_fk", zoneId, Tables.zones)(_.id)
  def uniq   = index("seats_zone_row_number_uniq", (zoneId, row, number), unique = true)
  def * : ProvenShape[SeatRow] =
    (id, zoneId, label, row, number, status).mapTo[SeatRow]
}

class Clients(tag: Tag) extends CystadiumTable[ClientRow](tag, "clients") {
  def id           = column[UUID]("id", O.PrimaryKey)
  def email        = column[String]("email", O.Unique)
  def name         = column[String]("name")
  def username     = column[String]("username", O.Unique)
  def passwordHash = column[Option[String]]("password_hash")
  def isAdmin      = column[Boolean]("is_admin")
  def * : ProvenShape[ClientRow] =
    (id, email, name, username, passwordHash, isAdmin).mapTo[ClientRow]
}

class Sessions(tag: Tag) extends CystadiumTable[SessionRow](tag, "sessions") {
  def id        = column[UUID]("id", O.PrimaryKey)
  def clientId  = column[UUID]("client_id")
  def createdAt = column[Instant]("created_at")
  def expiresAt = column[Instant]("expires_at")
  def clientFk  = foreignKey("sessions_client_fk", clientId, Tables.clients)(_.id)
  def * : ProvenShape[SessionRow] =
    (id, clientId, createdAt, expiresAt).mapTo[SessionRow]
}

class Reservations(tag: Tag) extends CystadiumTable[ReservationRow](tag, "reservations") {
  def id        = column[UUID]("id", O.PrimaryKey)
  def clientId  = column[UUID]("client_id")
  def matchId   = column[UUID]("match_id")
  def status    = column[String]("status")
  def total     = column[BigDecimal]("total")
  def createdAt = column[Instant]("created_at")
  def expiresAt = column[Option[Instant]]("expires_at")
  def clientFk  = foreignKey("reservations_client_fk", clientId, Tables.clients)(_.id)
  def matchFk   = foreignKey("reservations_match_fk", matchId, Tables.matches)(_.id)
  def * : ProvenShape[ReservationRow] =
    (id, clientId, matchId, status, total, createdAt, expiresAt).mapTo[ReservationRow]
}

class ReservationSeats(tag: Tag) extends CystadiumTable[ReservationSeatRow](tag, "reservation_seats") {
  def reservationId = column[UUID]("reservation_id")
  def seatId        = column[UUID]("seat_id")
  def pk            = primaryKey("reservation_seats_pk", (reservationId, seatId))
  def reservationFk = foreignKey("rs_reservation_fk", reservationId, Tables.reservations)(_.id)
  def seatFk        = foreignKey("rs_seat_fk", seatId, Tables.seats)(_.id)
  def * : ProvenShape[ReservationSeatRow] =
    (reservationId, seatId).mapTo[ReservationSeatRow]
}

class Payments(tag: Tag) extends CystadiumTable[PaymentRow](tag, "payments") {
  def id             = column[UUID]("id", O.PrimaryKey)
  def reservationId  = column[UUID]("reservation_id")
  def amount         = column[BigDecimal]("amount")
  def status         = column[String]("status")
  def createdAt      = column[Instant]("created_at")
  def completedAt    = column[Option[Instant]]("completed_at")
  def reservationFk  = foreignKey("payments_reservation_fk", reservationId, Tables.reservations)(_.id)
  def * : ProvenShape[PaymentRow] =
    (id, reservationId, amount, status, createdAt, completedAt).mapTo[PaymentRow]
}

// ── TableQuery exposés ───────────────────────────────────────────────────────
object Tables {
  val matches          = TableQuery[Matches]
  val zones            = TableQuery[Zones]
  val seats            = TableQuery[Seats]
  val clients          = TableQuery[Clients]
  val sessions         = TableQuery[Sessions]
  val reservations     = TableQuery[Reservations]
  val reservationSeats = TableQuery[ReservationSeats]
  val payments         = TableQuery[Payments]
}
