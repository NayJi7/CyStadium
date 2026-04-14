package cystadium.json

import cystadium.protocol._
import io.circe._
import io.circe.generic.extras._
import io.circe.generic.extras.semiauto._
import io.circe.syntax._

import java.time.Instant
import java.util.UUID

// ─────────────────────────────────────────────────────────────────────────────
// FICHIER COLLECTIF — propriété du groupe entier
// Tous les types exposés via REST ou WebSocket doivent avoir leur codec ici.
// Convention : snake_case pour tous les champs JSON.
// ─────────────────────────────────────────────────────────────────────────────

object Codecs {

  implicit val circeConfig: Configuration =
    Configuration.default.withSnakeCaseMemberNames

  // ── Primitifs ──────────────────────────────────────────────────────────────
  implicit val uuidEncoder: Encoder[UUID]     = Encoder.encodeString.contramap(_.toString)
  implicit val uuidDecoder: Decoder[UUID]     = Decoder.decodeString.map(UUID.fromString)
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

  // ── SeatStatus (WebSocket — version simplifiée) ───────────────────────────
  // Pour le WebSocket on n'expose que le label de statut, pas les détails internes.
  implicit val seatStatusEncoder: Encoder[SeatStatus] = Encoder.encodeString.contramap {
    case Free           => "free"
    case Reserved(_,_,_) => "reserved"
    case Confirmed(_,_)  => "confirmed"
    case Locked          => "locked"
  }

  // ── Messages REST ─────────────────────────────────────────────────────────
  implicit val loginEncoder: Encoder[Login]               = deriveConfiguredEncoder
  implicit val loginDecoder: Decoder[Login]               = deriveConfiguredDecoder
  implicit val loginSuccessEncoder: Encoder[LoginSuccess] = deriveConfiguredEncoder
  implicit val logoutDecoder: Decoder[Logout]             = deriveConfiguredDecoder

  implicit val reserveSeatsDecoder: Decoder[ReserveSeats]     = deriveConfiguredDecoder
  implicit val seatsReservedEncoder: Encoder[SeatsReserved]   = deriveConfiguredEncoder
  implicit val seatsUnavailableEncoder: Encoder[SeatsUnavailable] = deriveConfiguredEncoder

  implicit val initPaymentDecoder: Decoder[InitPayment]          = deriveConfiguredDecoder
  implicit val paymentSuccessEncoder: Encoder[PaymentSuccess]    = deriveConfiguredEncoder
  implicit val paymentFailedEncoder: Encoder[PaymentFailed]      = deriveConfiguredEncoder
  implicit val paymentTimeoutEncoder: Encoder[PaymentTimeout]    = deriveConfiguredEncoder

  implicit val reservationConfirmedEncoder: Encoder[ReservationConfirmed] = deriveConfiguredEncoder
  implicit val cancelReservationDecoder: Decoder[CancelReservation]       = deriveConfiguredDecoder
  implicit val seatsReleasedEncoder: Encoder[SeatsReleased]               = deriveConfiguredEncoder

  implicit val availabilityResultEncoder: Encoder[AvailabilityResult] = deriveConfiguredEncoder

  // ── Événement WebSocket ────────────────────────────────────────────────────
  implicit val seatStatusEventEncoder: Encoder[SeatStatusEvent] = deriveConfiguredEncoder

  // ── Réponses d'erreur standard ────────────────────────────────────────────
  def errorJson(message: String): Json =
    Json.obj("error" -> Json.fromString(message))

  val serviceUnavailable: Json = errorJson("service_unavailable")
  val unauthorized: Json       = errorJson("unauthorized")
  val notFound: Json           = errorJson("not_found")
}
