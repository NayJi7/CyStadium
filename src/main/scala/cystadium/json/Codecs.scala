package cystadium.json

import cystadium.protocol._
import io.circe._
import io.circe.generic.extras._
import io.circe.generic.extras.semiauto._
import io.circe.syntax._

import java.time.Instant
import java.util.UUID

object Codecs {

  implicit val circeConfig: Configuration =
    Configuration.default.withSnakeCaseMemberNames

  // ── Primitifs ──────────────────────────────────────────────────────────────
  implicit val uuidEncoder: Encoder[UUID]       = Encoder.encodeString.contramap(_.toString)
  implicit val uuidDecoder: Decoder[UUID]       = Decoder.decodeString.map(UUID.fromString)
  implicit val instantEncoder: Encoder[Instant] = Encoder.encodeLong.contramap(_.toEpochMilli)
  implicit val instantDecoder: Decoder[Instant] = Decoder.decodeLong.map(Instant.ofEpochMilli)

  // ── Zone ──────────────────────────────────────────────────────────────────
  implicit val zoneEncoder: Encoder[Zone] = Encoder.encodeString.contramap {
    case VIP       => "VIP"
    case Or        => "Or"
    case Standard  => "Standard"
    case Populaire => "Populaire"
  }
  implicit val zoneDecoder: Decoder[Zone] = Decoder.decodeString.emap {
    case "VIP"       => Right(VIP)
    case "Or"        => Right(Or)
    case "Standard"  => Right(Standard)
    case "Populaire" => Right(Populaire)
    case other       => Left(s"Zone inconnue: $other")
  }

  // Map[Zone, Int] dans AvailabilityResult nécessite KeyEncoder/KeyDecoder
  implicit val zoneKeyEncoder: KeyEncoder[Zone] = KeyEncoder.instance {
    case VIP       => "VIP"
    case Or        => "Or"
    case Standard  => "Standard"
    case Populaire => "Populaire"
  }
  implicit val zoneKeyDecoder: KeyDecoder[Zone] = KeyDecoder.instance {
    case "VIP"       => Some(VIP)
    case "Or"        => Some(Or)
    case "Standard"  => Some(Standard)
    case "Populaire" => Some(Populaire)
    case _           => None
  }

  // ── SeatStatus ────────────────────────────────────────────────────────────
  implicit val seatStatusEncoder: Encoder[SeatStatus] = Encoder.encodeString.contramap {
    case Free            => "free"
    case Reserved(_, _, _) => "reserved"
    case Confirmed(_, _)   => "confirmed"
    case Locked          => "locked"
  }

  // ── Messages REST ─────────────────────────────────────────────────────────
  implicit val registerDecoder: Decoder[Register]               = deriveConfiguredDecoder
  implicit val registerSuccessEncoder: Encoder[RegisterSuccess] = deriveConfiguredEncoder
  implicit val registerFailedEncoder: Encoder[RegisterFailed]   = deriveConfiguredEncoder

  implicit val loginEncoder: Encoder[Login]             = deriveConfiguredEncoder
  implicit val loginDecoder: Decoder[Login]             = deriveConfiguredDecoder
  implicit val loginSuccessEncoder: Encoder[LoginSuccess] = deriveConfiguredEncoder
  implicit val loginFailedEncoder: Encoder[LoginFailed]   = deriveConfiguredEncoder
  implicit val logoutDecoder: Decoder[Logout]             = deriveConfiguredDecoder

  implicit val reserveSeatsDecoder: Decoder[ReserveSeats]         = deriveConfiguredDecoder
  implicit val seatsReservedEncoder: Encoder[SeatsReserved]       = deriveConfiguredEncoder
  implicit val seatsUnavailableEncoder: Encoder[SeatsUnavailable] = deriveConfiguredEncoder

  implicit val initPaymentDecoder: Decoder[InitPayment]       = deriveConfiguredDecoder
  implicit val paymentSuccessEncoder: Encoder[PaymentSuccess] = deriveConfiguredEncoder
  implicit val paymentFailedEncoder: Encoder[PaymentFailed]   = deriveConfiguredEncoder
  implicit val paymentTimeoutEncoder: Encoder[PaymentTimeout] = deriveConfiguredEncoder

  implicit val reservationConfirmedEncoder: Encoder[ReservationConfirmed] = deriveConfiguredEncoder
  implicit val cancelReservationDecoder: Decoder[CancelReservation]       = deriveConfiguredDecoder
  implicit val seatsReleasedEncoder: Encoder[SeatsReleased]               = deriveConfiguredEncoder

  // AvailabilityResult contient Map[Zone, Int] — encoder manuel car deriveConfiguredEncoder
  // ne supporte pas les Map avec clé non-String directement.
  implicit val availabilityResultEncoder: Encoder[AvailabilityResult] =
    Encoder.instance { r =>
      Json.obj(
        "match_id" -> r.matchId.asJson,
        "zones"    -> Encoder.encodeMap[Zone, Int].apply(r.zones)
      )
    }

  // ── Événement WebSocket ────────────────────────────────────────────────────
  implicit val seatStatusEventEncoder: Encoder[SeatStatusEvent] = Encoder.instance { ev =>
    Json.obj(
      "type"    -> Json.fromString("seat_status"),
      "match_id" -> ev.matchId.asJson,
      "seat_id"  -> ev.seatId.asJson,
      "status"   -> ev.status.asJson
    )
  }

  implicit val reservationCountEventEncoder: Encoder[ReservationCountEvent] = Encoder.instance { ev =>
    Json.obj(
      "type"    -> Json.fromString("reservation_count"),
      "match_id" -> ev.matchId.asJson,
      "count"    -> Json.fromInt(ev.activeCount)
    )
  }

  // ── DTOs HTTP (MatchRoutes / ReservationRoutes) ────────────────────────────
  import cystadium.api.{MatchDto, ZoneDto, SeatDto, ReservationDto, ReservationSeatDto}

  implicit val matchDtoEncoder: Encoder[MatchDto]                     = deriveConfiguredEncoder
  implicit val zoneDtoEncoder: Encoder[ZoneDto]                       = deriveConfiguredEncoder
  implicit val seatDtoEncoder: Encoder[SeatDto]                       = deriveConfiguredEncoder
  implicit val reservationSeatDtoEncoder: Encoder[ReservationSeatDto] = deriveConfiguredEncoder
  implicit val reservationDtoEncoder: Encoder[ReservationDto]         = deriveConfiguredEncoder

  // ── Admin DTOs ────────────────────────────────────────────────────────────
  import cystadium.api.{
    CreateMatchRequest, UpdateMatchRequest, PatchUserRequest,
    KpisDto, DayCountDto, ZoneOccupancyDto, MatchRevenueDto, AdminStatsDto,
    AdminMatchDto, AdminUserDto, AdminReservationDto
  }

  implicit val createMatchRequestDecoder: Decoder[CreateMatchRequest]   = deriveConfiguredDecoder
  implicit val updateMatchRequestDecoder: Decoder[UpdateMatchRequest]   = deriveConfiguredDecoder
  implicit val patchUserRequestDecoder: Decoder[PatchUserRequest]       = deriveConfiguredDecoder

  implicit val kpisDtoEncoder: Encoder[KpisDto]                         = deriveConfiguredEncoder
  implicit val dayCountDtoEncoder: Encoder[DayCountDto]                 = deriveConfiguredEncoder
  implicit val zoneOccupancyDtoEncoder: Encoder[ZoneOccupancyDto]       = deriveConfiguredEncoder
  implicit val matchRevenueDtoEncoder: Encoder[MatchRevenueDto]         = deriveConfiguredEncoder
  implicit val adminStatsDtoEncoder: Encoder[AdminStatsDto]             = deriveConfiguredEncoder
  implicit val adminMatchDtoEncoder: Encoder[AdminMatchDto]             = deriveConfiguredEncoder
  implicit val adminUserDtoEncoder: Encoder[AdminUserDto]               = deriveConfiguredEncoder
  implicit val adminReservationDtoEncoder: Encoder[AdminReservationDto] = deriveConfiguredEncoder

  // ── Actor monitoring ─────────────────────────────────────────────────
  // Manual encoders to produce camelCase JSON for the frontend
  import cystadium.actors.Supervisor._

  implicit val zoneStatusEncoder: Encoder[ZoneStatus] = Encoder.instance { z =>
    Json.obj(
      "zone"           -> Json.fromString(z.zone),
      "totalSeats"     -> Json.fromInt(z.totalSeats),
      "freeSeats"      -> Json.fromInt(z.freeSeats),
      "reservedSeats"  -> Json.fromInt(z.reservedSeats),
      "confirmedSeats" -> Json.fromInt(z.confirmedSeats),
      "lockedSeats"    -> Json.fromInt(z.lockedSeats),
      "seatActorCount" -> Json.fromInt(z.seatActorCount)
    )
  }

  implicit val matchManagerStatusEncoder: Encoder[MatchManagerStatus] = Encoder.instance { mm =>
    Json.obj(
      "matchId" -> Json.fromString(mm.matchId),
      "zones"   -> Encoder.encodeMap[String, ZoneStatus].apply(mm.zones)
    )
  }

  implicit val actorStatusEncoder: Encoder[ActorStatus] = Encoder.instance { a =>
    Json.obj(
      "matchManagers"                  -> Encoder.encodeMap[String, MatchManagerStatus].apply(a.matchManagers),
      "reservationHandlerReservations" -> Json.fromInt(a.reservationHandlerReservations),
      "paymentGatewayPending"          -> Json.fromInt(a.paymentGatewayPending),
      "totalSeatActors"                -> Json.fromInt(a.totalSeatActors),
      "totalZoneManagers"              -> Json.fromInt(a.totalZoneManagers),
      "sessionManagerActive"           -> Json.fromBoolean(a.sessionManagerActive),
      "seatAllocatorActive"            -> Json.fromBoolean(a.seatAllocatorActive),
      "reservationHandlerActive"       -> Json.fromBoolean(a.reservationHandlerActive),
      "paymentGatewayActive"           -> Json.fromBoolean(a.paymentGatewayActive)
    )
  }

  // ── Réponses d'erreur standard ────────────────────────────────────────────
  def errorJson(message: String): Json =
    Json.obj("error" -> Json.fromString(message))

  val serviceUnavailable: Json = errorJson("service_unavailable")
  val unauthorized: Json       = errorJson("unauthorized")
  val notFound: Json           = errorJson("not_found")
}
