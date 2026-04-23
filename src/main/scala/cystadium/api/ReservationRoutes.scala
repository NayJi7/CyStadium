package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{Directive1, Route}
import akka.pattern.ask
import akka.util.Timeout
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._

// ─────────────────────────────────────────────────────────────────────────────
// ReservationRoutes — Adam
// Toutes protégées par le middleware authenticated (header X-Session-Id).
//
//   POST /api/reservations                → ReserveSeats → SeatsReserved | SeatsUnavailable(409)
//   POST /api/reservations/{id}/pay       → InitPayment  → PaymentSuccess | PaymentFailed(402) | PaymentTimeout(504)
//   POST /api/reservations/{id}/cancel    → CancelReservation → SeatsReleased
//
// ActorRefs fournis par le Supervisor collectif :
//   - reservationHandler (Fatima/Abdel)
//   - paymentGateway     (Fatima/Abdel)
// ─────────────────────────────────────────────────────────────────────────────

class ReservationRoutes(
  reservationHandler: ActorRef,
  paymentGateway:     ActorRef,
  authenticated:      Directive1[ClientId]
)(implicit askTimeout: Timeout) {

  val routes: Route =
    pathPrefix("reservations") {
      authenticated { _ =>
        concat(
          pathEndOrSingleSlash {
            post {
              entity(as[ReserveSeats]) { req =>
                onSuccess((reservationHandler ? req).mapTo[Any]) {
                  case ok: SeatsReserved =>
                    complete(StatusCodes.Created -> ok)
                  case ko: SeatsUnavailable =>
                    complete(StatusCodes.Conflict -> ko)
                  case other =>
                    complete(StatusCodes.InternalServerError -> errorJson(s"unexpected: $other"))
                }
              }
            }
          },
          path(JavaUUID / "pay") { reservationId =>
            post {
              entity(as[InitPayment]) { body =>
                val req =
                  if (body.reservationId == reservationId) body
                  else body.copy(reservationId = reservationId)
                onSuccess((paymentGateway ? req).mapTo[Any]) {
                  case ok: PaymentSuccess =>
                    complete(StatusCodes.OK -> ok)
                  case ko: PaymentFailed =>
                    complete(StatusCodes.PaymentRequired -> ko)
                  case to: PaymentTimeout =>
                    complete(StatusCodes.GatewayTimeout -> to)
                  case other =>
                    complete(StatusCodes.InternalServerError -> errorJson(s"unexpected: $other"))
                }
              }
            }
          },
          path(JavaUUID / "cancel") { reservationId =>
            post {
              entity(as[CancelReservation]) { body =>
                val req =
                  if (body.reservationId == reservationId) body
                  else body.copy(reservationId = reservationId)
                onSuccess((reservationHandler ? req).mapTo[SeatsReleased]) { r =>
                  complete(StatusCodes.OK -> r)
                }
              }
            }
          }
        )
      }
    }
}
