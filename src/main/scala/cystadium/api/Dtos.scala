package cystadium.api

import java.util.UUID

case class MatchDto(
  id: UUID, homeTeam: String, awayTeam: String,
  date: String,                   // ISO-8601, ex: "2026-06-14T20:00:00Z"
  stadium: String, status: String,
  zones: Map[String, Int]         // nom zone -> nb sièges libres
)

case class ZoneDto(zoneId: UUID, name: String, price: Double, available: Int)

case class SeatDto(
  seatId: UUID, label: String, row: String, number: Int,
  zone: String, status: String, section: String
)

case class ReservationSeatDto(seatId: UUID, label: String, zone: String, status: String)

case class ReservationDto(
  reservationId: UUID, matchId: UUID,
  seats: List[ReservationSeatDto],
  total: Double, status: String,
  expiresAt: Option[Long]
)
