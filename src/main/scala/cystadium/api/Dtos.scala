package cystadium.api

import java.util.UUID

case class MatchDto(
  id: UUID, homeTeam: String, awayTeam: String,
  date: String,
  stadium: String, city: Option[String], stage: Option[String],
  status: String, highlight: Boolean,
  zones: Map[String, Int],
  slug: String
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

// ── Admin DTOs ────────────────────────────────────────────────────────────────

case class CreateMatchRequest(
  homeTeam: String, awayTeam: String,
  date: String,
  stadium: String, city: Option[String], stage: Option[String],
  totalCapacity: Int,
  zones: Map[String, Int],
  highlight: Boolean
)

case class UpdateMatchRequest(
  homeTeam: Option[String], awayTeam: Option[String],
  date: Option[String],
  stadium: Option[String], city: Option[String], stage: Option[String],
  highlight: Option[Boolean],
  totalCapacity: Option[Int],
  zones: Option[Map[String, Int]]
)

case class PatchUserRequest(isAdmin: Boolean)

case class KpisDto(
  totalRevenue: Double, totalReservations: Int,
  avgOccupancy: Double, totalFreeSeats: Int
)

case class DayCountDto(date: String, count: Int)
case class ZoneOccupancyDto(zone: String, free: Int, occupied: Int)
case class MatchRevenueDto(matchName: String, revenue: Double)

case class AdminStatsDto(
  kpis: KpisDto,
  reservationsOverTime: List[DayCountDto],
  occupancyByZone: List[ZoneOccupancyDto],
  revenueByMatch: List[MatchRevenueDto]
)

case class AdminMatchDto(
  id: UUID, homeTeam: String, awayTeam: String,
  date: String, stadium: String, city: Option[String], stage: Option[String],
  slug: String, highlight: Boolean, status: String,
  zones: Map[String, Int],
  totalCapacity: Int, freeSeats: Int
)

case class AdminUserDto(
  id: UUID, email: String, name: String, username: String,
  isAdmin: Boolean
)

case class AdminReservationDto(
  reservationId: UUID, matchId: UUID, matchName: String,
  clientEmail: String, seats: Int, total: Double,
  status: String, createdAt: Long
)
