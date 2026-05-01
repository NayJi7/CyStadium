package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.pattern.ask
import akka.util.Timeout
import cystadium.db.Tables
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.{ExecutionContext, Future}

class MatchRoutes(
  matchManager:    ActorRef,
  matchManagerMap: Map[MatchId, ActorRef],
  db:              slick.jdbc.PostgresProfile.backend.Database
)(implicit askTimeout: Timeout, ec: ExecutionContext) {

  val routes: Route =
    pathPrefix("matches") {
      concat(
        pathEndOrSingleSlash {
          get {
            // Charge les matchs puis interroge chaque MatchManager pour la dispo
            val result = db.run(Tables.matches.result).flatMap { rows =>
              Future.sequence(rows.map { r =>
                matchManagerMap.get(r.id) match {
                  case None =>
                    Future.successful(MatchDto(r.id, r.homeTeam, r.awayTeam,
                      r.matchDate.toString, r.stadium, r.status, Map.empty))
                  case Some(mm) =>
                    (mm ? CheckAvailability(r.id)).mapTo[AvailabilityResult]
                      .map { avail =>
                        val zones = avail.zones.map { case (z, n) => zoneToName(z) -> n }
                        MatchDto(r.id, r.homeTeam, r.awayTeam,
                          r.matchDate.toString, r.stadium, r.status, zones)
                      }
                      .recover { case _ =>
                        MatchDto(r.id, r.homeTeam, r.awayTeam,
                          r.matchDate.toString, r.stadium, r.status, Map.empty)
                      }
                }
              })
            }
            onSuccess(result) { dtos => complete(StatusCodes.OK -> dtos) }
          }
        },
        path(JavaUUID) { matchId =>
          get {
            matchManagerMap.get(matchId) match {
              case None =>
                complete(StatusCodes.NotFound -> errorJson(s"Match $matchId introuvable"))
              case Some(mm) =>
                onSuccess((mm ? CheckAvailability(matchId)).mapTo[AvailabilityResult]) { r =>
                  complete(StatusCodes.OK -> r)
                }
            }
          }
        },
        path(JavaUUID / "zones") { matchId =>
          get {
            val zonesFuture = db.run(Tables.zones.filter(_.matchId === matchId).result)
            matchManagerMap.get(matchId) match {
              case None =>
                onSuccess(zonesFuture) { zones =>
                  complete(StatusCodes.OK -> zones.map(z => ZoneDto(z.id, z.name, z.price.toDouble, 0)))
                }
              case Some(mm) =>
                val availFuture = (mm ? CheckAvailability(matchId)).mapTo[AvailabilityResult]
                onSuccess(for { z <- zonesFuture; a <- availFuture } yield (z, a)) {
                  case (zones, avail) =>
                    val dispoByName = avail.zones.map { case (z, n) => zoneToName(z) -> n }
                    val dtos = zones.map(z =>
                      ZoneDto(z.id, z.name, z.price.toDouble, dispoByName.getOrElse(z.name, 0))
                    )
                    complete(StatusCodes.OK -> dtos)
                }
            }
          }
        },
        path(JavaUUID / "seats") { matchId =>
          get {
            val query = for {
              seat <- Tables.seats
              zone <- Tables.zones if zone.id === seat.zoneId && zone.matchId === matchId
            } yield (seat, zone.name)
            onSuccess(db.run(query.result)) { rows =>
              val dtos = rows.map { case (s, zoneName) =>
                SeatDto(s.id, s.label, s.row, s.number, zoneName, s.status, "General")
              }
              complete(StatusCodes.OK -> dtos)
            }
          }
        }
      )
    }

  private def zoneToName(z: Zone): String = z match {
    case VIP       => "VIP"
    case Or        => "Or"
    case Standard  => "Standard"
    case Populaire => "Populaire"
  }
}
