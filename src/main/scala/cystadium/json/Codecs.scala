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
  implicit val seatStatusEventEncoder: Encoder[SeatStatusEvent] = deriveConfiguredEncoder

  // ── Réponses d'erreur standard ────────────────────────────────────────────
  def errorJson(message: String): Json =
    Json.obj("error" -> Json.fromString(message))

  val serviceUnavailable: Json = errorJson("service_unavailable")
  val unauthorized: Json       = errorJson("unauthorized")
  val notFound: Json           = errorJson("not_found")
}
