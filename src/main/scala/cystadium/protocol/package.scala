package cystadium

import java.util.UUID

package object protocol {
  type ClientId      = UUID
  type SessionId     = UUID
  type MatchId       = UUID
  type ZoneId        = UUID
  type SeatId        = UUID
  type ReservationId = UUID
  type BookingId     = UUID
}
