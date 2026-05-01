package cystadium.api

import java.util.UUID

case class MatchDto(
  id: UUID, homeTeam: String, awayTeam: String,
  date: Long,
  stadium: String, status: String
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
