package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{Directive1, Route}
import akka.pattern.ask
import akka.util.Timeout
import cystadium.db.Tables
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import slick.jdbc.PostgresProfile.api._

import java.util.UUID
import scala.concurrent.ExecutionContext

class ReservationRoutes(
  reservationHandler: ActorRef,
  paymentGateway:     ActorRef,
  db:                 slick.jdbc.PostgresProfile.backend.Database,
  authenticated:      Directive1[ClientId]
)(implicit askTimeout: Timeout, ec: ExecutionContext) {

  val routes: Route =
    pathPrefix("reservations") {
      authenticated { clientId =>
        concat(
          pathEndOrSingleSlash {
            concat(
              post {
                entity(as[ReserveSeats]) { req =>
                  onSuccess((reservationHandler ? req).mapTo[Any]) {
                    case ok: SeatsReserved    => complete(StatusCodes.Created -> ok)
                    case ko: SeatsUnavailable => complete(StatusCodes.Conflict -> ko)
                    case other                => complete(StatusCodes.InternalServerError -> errorJson(s"unexpected: $other"))
                  }
                }
              },
              get {
                onSuccess(fetchReservations(clientId)) { dtos =>
                  complete(StatusCodes.OK -> dtos)
                }
              }
            )
          },
          path(JavaUUID / "pay") { reservationId =>
            post {
              entity(as[InitPayment]) { body =>
                val req = if (body.reservationId == reservationId) body else body.copy(reservationId = reservationId)
                onSuccess((paymentGateway ? req).mapTo[Any]) {
                  case ok: PaymentSuccess => complete(StatusCodes.OK -> ok)
                  case ko: PaymentFailed  => complete(StatusCodes.PaymentRequired -> ko)
                  case to: PaymentTimeout => complete(StatusCodes.GatewayTimeout -> to)
                  case other              => complete(StatusCodes.InternalServerError -> errorJson(s"unexpected: $other"))
                }
              }
            }
          },
          path(JavaUUID / "cancel") { reservationId =>
            post {
              entity(as[CancelReservation]) { body =>
                val req = if (body.reservationId == reservationId) body else body.copy(reservationId = reservationId)
                onSuccess((reservationHandler ? req).mapTo[SeatsReleased]) { r =>
                  complete(StatusCodes.OK -> r)
                }
              }
            }
          },
          path(JavaUUID) { reservationId =>
            get {
              onSuccess(fetchReservation(reservationId)) {
                case Some(dto) => complete(StatusCodes.OK -> dto)
                case None      => complete(StatusCodes.NotFound -> errorJson("not_found"))
              }
            }
          }
        )
      }
    }

  private def fetchReservations(clientId: ClientId) = {
    val query = for {
      res  <- Tables.reservations.filter(r => r.clientId === clientId && r.status =!= "cancelled")
      rs   <- Tables.reservationSeats.filter(_.reservationId === res.id)
      seat <- Tables.seats.filter(_.id === rs.seatId)
      zone <- Tables.zones.filter(_.id === seat.zoneId)
    } yield (res, seat, zone.name)

    db.run(query.result).map { rows =>
      rows.groupBy(_._1.id).values.map { group =>
        val res   = group.head._1
        val seats = group.map { case (_, seat, zoneName) =>
          ReservationSeatDto(seat.id, seat.label, zoneName, seat.status)
        }.toList
        ReservationDto(res.id, res.matchId, seats, res.total.toDouble, res.status,
          res.expiresAt.map(_.toEpochMilli))
      }.toList
    }
  }

  private def fetchReservation(reservationId: UUID) = {
    val query = for {
      res  <- Tables.reservations.filter(_.id === reservationId)
      rs   <- Tables.reservationSeats.filter(_.reservationId === res.id)
      seat <- Tables.seats.filter(_.id === rs.seatId)
      zone <- Tables.zones.filter(_.id === seat.zoneId)
    } yield (res, seat, zone.name)

    db.run(query.result).map { rows =>
      if (rows.isEmpty) None
      else {
        val res   = rows.head._1
        val seats = rows.map { case (_, seat, zoneName) =>
          ReservationSeatDto(seat.id, seat.label, zoneName, seat.status)
        }.toList
        Some(ReservationDto(res.id, res.matchId, seats, res.total.toDouble, res.status,
          res.expiresAt.map(_.toEpochMilli)))
      }
    }
  }
}
