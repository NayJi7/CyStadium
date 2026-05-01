package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{Directive1, Route}
import akka.pattern.ask
import akka.util.Timeout
import cystadium.db.{Tables, MatchRow, ZoneRow, SeatRow}
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import slick.jdbc.PostgresProfile.api._

import java.time.Instant
import java.util.UUID
import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

class AdminRoutes(
  sessionManager:  ActorRef,
  matchManagerMap: Map[MatchId, ActorRef],
  db:              slick.jdbc.PostgresProfile.backend.Database
)(implicit askTimeout: Timeout, ec: ExecutionContext) {

  private def authenticatedAdmin: Directive1[ClientId] =
    headerValueByName("X-Session-Id").flatMap { sidStr =>
      Try(UUID.fromString(sidStr)).toOption match {
        case None => complete(StatusCodes.Unauthorized -> unauthorized)
        case Some(sid) =>
          val future: Future[Option[ClientId]] =
            (sessionManager ? ValidateSession(sid)).mapTo[Any].flatMap {
              case SessionValid(clientId) =>
                db.run(Tables.clients.filter(_.id === clientId).map(_.isAdmin).result.headOption)
                  .map(opt => if (opt.getOrElse(false)) Some(clientId) else None)
              case _ => Future.successful(None)
            }
          onSuccess(future).flatMap {
            case Some(clientId) => provide(clientId)
            case None           => complete(StatusCodes.Forbidden -> errorJson("forbidden"))
          }
      }
    }

  val routes: Route =
    pathPrefix("admin") {
      authenticatedAdmin { _ =>
        concat(
          path("stats") {
            get {
              parameter("period" ? "30d") { period =>
                onSuccess(fetchStats(period)) { stats =>
                  complete(StatusCodes.OK -> stats)
                }
              }
            }
          },

          pathPrefix("users") {
            concat(
              pathEndOrSingleSlash {
                get {
                  onSuccess(db.run(Tables.clients.result)) { rows =>
                    val dtos = rows.map(c => AdminUserDto(c.id, c.email, c.name, c.username, c.isAdmin)).toList
                    complete(StatusCodes.OK -> dtos)
                  }
                }
              },
              path(JavaUUID) { userId =>
                patch {
                  entity(as[PatchUserRequest]) { req =>
                    val update = Tables.clients.filter(_.id === userId).map(_.isAdmin).update(req.isAdmin)
                    onSuccess(db.run(update)) { count =>
                      if (count > 0) complete(StatusCodes.OK -> io.circe.Json.obj("updated" -> io.circe.Json.fromBoolean(true)))
                      else complete(StatusCodes.NotFound -> notFound)
                    }
                  }
                }
              }
            )
          },

          pathPrefix("matches") {
            concat(
              pathEndOrSingleSlash {
                concat(
                  get { onSuccess(fetchAdminMatches()) { ms => complete(StatusCodes.OK -> ms) } },
                  post { entity(as[CreateMatchRequest]) { req =>
                    onSuccess(createMatch(req)) { dto => complete(StatusCodes.Created -> dto) }
                  }}
                )
              },
              path(JavaUUID) { matchId =>
                concat(
                  put { entity(as[UpdateMatchRequest]) { req =>
                    onSuccess(updateMatch(matchId, req)) {
                      case Some(dto) => complete(StatusCodes.OK -> dto)
                      case None      => complete(StatusCodes.NotFound -> notFound)
                    }
                  }},
                  delete {
                    onSuccess(deleteMatch(matchId)) { _ => complete(StatusCodes.NoContent) }
                  }
                )
              }
            )
          },

          pathPrefix("reservations") {
            pathEndOrSingleSlash {
              get {
                parameters("status".optional, "matchId".optional) { (statusFilter, matchIdFilter) =>
                  onSuccess(fetchAdminReservations(statusFilter, matchIdFilter.flatMap(s => Try(UUID.fromString(s)).toOption))) { dtos =>
                    complete(StatusCodes.OK -> dtos)
                  }
                }
              }
            }
          }
        )
      }
    }

  private def fetchStats(period: String): Future[AdminStatsDto] = {
    val cutoff: Option[Instant] = period match {
      case "7d"  => Some(Instant.now().minusSeconds(7L  * 86400))
      case "30d" => Some(Instant.now().minusSeconds(30L * 86400))
      case "90d" => Some(Instant.now().minusSeconds(90L * 86400))
      case _     => None
    }

    val revenueQ = {
      val base = Tables.reservations.filter(r => r.status === "paid" || r.status === "confirmed")
      cutoff.fold(base)(c => base.filter(_.createdAt >= c))
        .map(_.total).sum.getOrElse(BigDecimal(0)).result
    }

    val countQ = {
      val base = Tables.reservations.filter(r => r.status === "paid" || r.status === "confirmed")
      cutoff.fold(base)(c => base.filter(_.createdAt >= c)).length.result
    }

    val freeSeatsQ  = Tables.seats.filter(_.status === "free").length.result
    val totalSeatsQ = Tables.seats.length.result

    val occupancyByZoneQ = (for {
      zone <- Tables.zones
      seat <- Tables.seats if seat.zoneId === zone.id
    } yield (zone.name, seat.status)).result

    val days = period match {
      case "7d" => 7; case "30d" => 30; case "90d" => 90; case _ => 365
    }
    val overTimeQ = sql"""
      SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as d, COUNT(*)::int
      FROM reservations
      WHERE status IN ('paid','confirmed')
        AND created_at >= NOW() - (#$days || ' days')::interval
      GROUP BY 1 ORDER BY 1
    """.as[(String, Int)]

    val revenueByMatchQ = sql"""
      SELECT m.home_team || ' - ' || m.away_team,
             COALESCE(SUM(r.total), 0)::double precision
      FROM matches m
      LEFT JOIN reservations r ON r.match_id = m.id
        AND r.status IN ('paid','confirmed')
      GROUP BY m.id, m.home_team, m.away_team
      ORDER BY 2 DESC
      LIMIT 6
    """.as[(String, Double)]

    for {
      revenue    <- db.run(revenueQ)
      count      <- db.run(countQ)
      freeSeats  <- db.run(freeSeatsQ)
      totalSeats <- db.run(totalSeatsQ)
      occupancy  <- db.run(occupancyByZoneQ)
      overTime   <- db.run(overTimeQ)
      revByMatch <- db.run(revenueByMatchQ)
    } yield {
      val avgOcc = if (totalSeats == 0) 0.0
                   else ((totalSeats - freeSeats).toDouble / totalSeats) * 100.0

      val occupancyByZone = occupancy
        .groupBy(_._1)
        .map { case (name, rows) =>
          ZoneOccupancyDto(name, rows.count(_._2 == "free"), rows.count(_._2 != "free"))
        }.toList
        .sortBy(z => List("VIP","Or","Standard","Populaire").indexOf(z.zone))

      val topMatches = revByMatch.map { case (name, rev) => MatchRevenueDto(name, rev) }.toList
      val revenueByMatch = if (topMatches.size <= 5) topMatches
        else topMatches.take(5) :+ MatchRevenueDto("Autres", topMatches.drop(5).map(_.revenue).sum)

      AdminStatsDto(
        kpis                 = KpisDto(revenue.toDouble, count, avgOcc, freeSeats),
        reservationsOverTime = overTime.map { case (d, c) => DayCountDto(d, c) }.toList,
        occupancyByZone      = occupancyByZone,
        revenueByMatch       = revenueByMatch
      )
    }
  }

  private def fetchAdminMatches(): Future[List[AdminMatchDto]] = {
    for {
      matchRows <- db.run(Tables.matches.result)
      dtos      <- Future.sequence(matchRows.map { r =>
        val freeByZoneF = db.run((for {
          z    <- Tables.zones if z.matchId === r.id
          seat <- Tables.seats if seat.zoneId === z.id && seat.status === "free"
        } yield z.name).result).map(rows => rows.groupBy(identity).view.mapValues(_.size).toMap)

        val freeCountF = db.run((for {
          z    <- Tables.zones if z.matchId === r.id
          seat <- Tables.seats if seat.zoneId === z.id && seat.status === "free"
        } yield seat).length.result)

        val totalF = db.run((for {
          z    <- Tables.zones if z.matchId === r.id
          seat <- Tables.seats if seat.zoneId === z.id
        } yield seat).length.result)

        for {
          freeByZone <- freeByZoneF
          free       <- freeCountF
          total      <- totalF
        } yield AdminMatchDto(
          r.id, r.homeTeam, r.awayTeam,
          r.matchDate.toString, r.stadium, r.city, r.stage,
          toSlug(r.homeTeam, r.awayTeam), r.highlight, r.status,
          freeByZone.toMap, total, free
        )
      })
    } yield dtos.toList
  }

  private def createMatch(req: CreateMatchRequest): Future[AdminMatchDto] = {
    val matchId = UUID.randomUUID()
    val matchDate = java.time.LocalDateTime.parse(req.date).toInstant(java.time.ZoneOffset.UTC)
    val matchRow = MatchRow(
      matchId, req.homeTeam, req.awayTeam, matchDate,
      req.stadium, "open", req.city, req.stage, req.highlight
    )

    val zonePrices = Map("VIP" -> 500.0, "Or" -> 250.0, "Standard" -> 100.0, "Populaire" -> 50.0)

    val zoneInserts = req.zones.map { case (zoneName, capacity) =>
      val zoneId  = UUID.randomUUID()
      val price   = BigDecimal(zonePrices.getOrElse(zoneName, 100.0))
      val zoneRow = ZoneRow(zoneId, matchId, zoneName, price, capacity)
      val seatRows = generateSeats(zoneId, zoneName, capacity)
      (zoneRow, seatRows)
    }

    val action = DBIO.seq(
      Tables.matches += matchRow,
      DBIO.seq(zoneInserts.toSeq.map { case (z, seats) =>
        DBIO.seq(Tables.zones += z, Tables.seats ++= seats)
      }: _*)
    ).transactionally

    db.run(action).map { _ =>
      AdminMatchDto(
        matchId, req.homeTeam, req.awayTeam,
        matchDate.toString, req.stadium, req.city, req.stage,
        toSlug(req.homeTeam, req.awayTeam), req.highlight, "open",
        req.zones, req.totalCapacity, req.totalCapacity
      )
    }
  }

  private def updateMatch(matchId: UUID, req: UpdateMatchRequest): Future[Option[AdminMatchDto]] = {
    db.run(Tables.matches.filter(_.id === matchId).result.headOption).flatMap {
      case None => Future.successful(None)
      case Some(existing) =>
        val newDate = req.date.fold(existing.matchDate)(d =>
          java.time.LocalDateTime.parse(d).toInstant(java.time.ZoneOffset.UTC))
        val q = Tables.matches.filter(_.id === matchId)
          .map(m => (m.homeTeam, m.awayTeam, m.matchDate, m.stadium, m.city, m.stage, m.highlight))
          .update((
            req.homeTeam.getOrElse(existing.homeTeam),
            req.awayTeam.getOrElse(existing.awayTeam),
            newDate,
            req.stadium.getOrElse(existing.stadium),
            req.city.orElse(existing.city),
            req.stage.orElse(existing.stage),
            req.highlight.getOrElse(existing.highlight)
          ))
        val newHomeTeam = req.homeTeam.getOrElse(existing.homeTeam)
        val newAwayTeam = req.awayTeam.getOrElse(existing.awayTeam)
        db.run(q).map { _ =>
          Some(AdminMatchDto(
            existing.id, newHomeTeam, newAwayTeam,
            newDate.toString, req.stadium.getOrElse(existing.stadium),
            req.city.orElse(existing.city), req.stage.orElse(existing.stage),
            toSlug(newHomeTeam, newAwayTeam),
            req.highlight.getOrElse(existing.highlight), existing.status,
            Map.empty, 0, 0
          ))
        }
    }
  }

  private def deleteMatch(matchId: UUID): Future[Int] =
    db.run(Tables.matches.filter(_.id === matchId).delete)

  private def fetchAdminReservations(
    statusFilter: Option[String],
    matchIdFilter: Option[UUID]
  ): Future[List[AdminReservationDto]] = {
    val statusCond  = statusFilter.fold("1=1")(s => s"r.status = '$s'")
    val matchCond   = matchIdFilter.fold("1=1")(id => s"r.match_id = '$id'")
    val q = sql"""
      SELECT r.id::text, r.match_id::text,
             m.home_team || ' - ' || m.away_team,
             c.email,
             (SELECT COUNT(*)::int FROM reservation_seats rs WHERE rs.reservation_id = r.id),
             r.total::double precision,
             r.status,
             EXTRACT(EPOCH FROM r.created_at)::bigint * 1000
      FROM reservations r
      JOIN matches m ON m.id = r.match_id
      JOIN clients c ON c.id = r.client_id
      WHERE (#$statusCond)
        AND (#$matchCond)
      ORDER BY r.created_at DESC
    """.as[(String, String, String, String, Int, Double, String, Long)]

    db.run(q).map { rows =>
      rows.map { case (id, mId, mName, email, seats, total, status, createdAt) =>
        AdminReservationDto(
          UUID.fromString(id), UUID.fromString(mId), mName,
          email, seats, total, status, createdAt
        )
      }.toList
    }
  }

  private def generateSeats(zoneId: UUID, zoneName: String, capacity: Int): Seq[SeatRow] = {
    val prefix = zoneName match {
      case "VIP"       => "VIP"
      case "Or"        => "OR"
      case "Standard"  => "STD"
      case "Populaire" => "POP"
      case other       => other.take(3).toUpperCase
    }
    val numRows     = math.ceil(capacity.toDouble / 10).toInt.min(26)
    val seatsPerRow = math.ceil(capacity.toDouble / numRows).toInt
    (0 until capacity).map { idx =>
      val rowIdx  = idx / seatsPerRow
      val seatNum = (idx % seatsPerRow) + 1
      val rowChar = ('A' + rowIdx).toChar.toString
      val label   = f"$prefix-$rowChar-$seatNum%02d"
      SeatRow(UUID.randomUUID(), zoneId, label, rowChar, seatNum, "free")
    }
  }

  private def toSlug(home: String, away: String): String = {
    val normalize = (s: String) => java.text.Normalizer
      .normalize(s, java.text.Normalizer.Form.NFD)
      .replaceAll("[^\\p{ASCII}]", "")
      .toLowerCase.replaceAll("[^a-z0-9]+", "-")
      .stripPrefix("-").stripSuffix("-")
    s"${normalize(home)}-${normalize(away)}"
  }
}
