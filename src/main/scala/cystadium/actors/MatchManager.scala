package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, Props}
import akka.pattern.{ask, pipe}
import akka.util.Timeout
import cystadium.db.Tables
import cystadium.protocol._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.Future
import scala.concurrent.duration._

object MatchManager {
  def props(matchId: MatchId, db: slick.jdbc.JdbcBackend#Database): Props =
    Props(new MatchManager(matchId, db))

  case class GetSeatRefs(matchId: MatchId, zone: Zone, seatIds: Set[SeatId])
  case class GetAllSeatRefs(matchId: MatchId, seatIds: Set[SeatId])
  case class SeatRefsResult(refs: Map[SeatId, ActorRef])
  case class AllSeatRefsResult(refs: Map[SeatId, ActorRef], zones: Map[SeatId, Zone])

  private case class InitialDataLoaded(data: List[(SeatId, Zone, Double, SeatStatus)])
  case object ReloadZones
  case object GetZoneStatuses
  case class ZoneStatuses(zones: Map[String, Supervisor.ZoneStatus])
}

class MatchManager(matchId: MatchId, db: slick.jdbc.JdbcBackend#Database)
    extends Actor with ActorLogging {

  import MatchManager._
  import context.dispatcher
  implicit val t: Timeout = Timeout(5.seconds)

  var zoneManagers: Map[Zone, ActorRef] = Map.empty

  override def preStart(): Unit = {
    log.info(s"MatchManager $matchId : chargement depuis la DB...")

    val loadFuture: Future[List[(SeatId, Zone, Double, SeatStatus)]] = for {
      zones <- db.run(Tables.zones.filter(_.matchId === matchId).result)
      seats <- db.run(Tables.seats
        .filter(_.zoneId.inSet(zones.map(_.id).toSet))
        .result)
    } yield {
      val zoneById = zones.map(z => z.id -> (nameToZone(z.name), z.price.toDouble)).toMap
      seats.toList.flatMap { s =>
        zoneById.get(s.zoneId).map { case (zone, price) =>
          val status: SeatStatus = s.status match {
            case "confirmed" => Confirmed(java.util.UUID.randomUUID(), java.util.UUID.randomUUID())
            case "locked"    => Locked
            case _           => Free
          }
          (s.id, zone, price, status)
        }
      }
    }

    loadFuture.map(InitialDataLoaded).pipeTo(self)
  }

  def receive: Receive = {
    case InitialDataLoaded(seats) =>
      val seatsByZone = seats.groupBy(_._2)
      zoneManagers = Seq(VIP, Or, Standard, Populaire).map { zType =>
        val zoneData = seatsByZone.getOrElse(zType, Nil).map(s => (s._1, s._3, s._4))
        val ref = context.actorOf(
          ZoneManager.props(matchId, zType, zoneData),
          s"zone-$zType"
        )
        zType -> ref
      }.toMap
      log.info(s"MatchManager $matchId : ${zoneManagers.size} zones, ${seats.size} sièges")

    case CheckAvailability(mId) if mId == matchId =>
      val replyTo = sender()
      val zoneFutures = zoneManagers.map { case (z, ref) =>
        (ref ? CheckAvailability(mId)).mapTo[Int].map(count => z -> count)
      }
      Future.sequence(zoneFutures).map { results =>
        replyTo ! AvailabilityResult(matchId, results.toMap)
      }

    case GetSeatRefs(_, zone, seatIds) =>
      zoneManagers.get(zone) match {
        case Some(zm) =>
          val replyTo = sender()
          (zm ? ZoneManager.GetSeatRefs(seatIds)).mapTo[ZoneManager.SeatRefsResult]
            .foreach(r => replyTo ! SeatRefsResult(r.refs))
        case None =>
          sender() ! SeatRefsResult(Map.empty)
      }

    case GetAllSeatRefs(_, seatIds) =>
      val replyTo = sender()
      val zoneFutures = zoneManagers.map { case (zone, zm) =>
        (zm ? ZoneManager.GetSeatRefs(seatIds)).mapTo[ZoneManager.SeatRefsResult]
          .map(r => (r.refs, zone))
      }
      Future.sequence(zoneFutures).map { results =>
        val mergedRefs = results.flatMap(_._1).toMap
        val seatZones = results.flatMap { case (refs, zone) =>
          refs.keys.map(_ -> zone)
        }.toMap
        replyTo ! AllSeatRefsResult(mergedRefs, seatZones)
      }

    case ReloadZones =>
      // Stop existing zone managers
      zoneManagers.values.foreach(context.stop)
      zoneManagers = Map.empty
      // Reload from DB (reuses preStart logic)
      log.info(s"MatchManager $matchId : rechargement des zones depuis la DB...")
      val loadFuture: Future[List[(SeatId, Zone, Double, SeatStatus)]] = for {
        zones <- db.run(Tables.zones.filter(_.matchId === matchId).result)
        seats <- db.run(Tables.seats
          .filter(_.zoneId.inSet(zones.map(_.id).toSet))
          .result)
      } yield {
        val zoneById = zones.map(z => z.id -> (nameToZone(z.name), z.price.toDouble)).toMap
        seats.toList.flatMap { s =>
          zoneById.get(s.zoneId).map { case (zone, price) =>
            val status: SeatStatus = s.status match {
              case "confirmed" => Confirmed(java.util.UUID.randomUUID(), java.util.UUID.randomUUID())
              case "locked"    => Locked
              case _           => Free
            }
            (s.id, zone, price, status)
          }
        }
      }
      loadFuture.map(InitialDataLoaded).pipeTo(self)

    case GetZoneStatuses =>
      val replyTo = sender()
      val zoneFutures = zoneManagers.map { case (zone, zm) =>
        (zm ? ZoneManager.GetStatusCounts).mapTo[ZoneManager.StatusCounts].map { zc =>
          val total = zc.free + zc.reserved + zc.confirmed + zc.locked
          zone.toString -> Supervisor.ZoneStatus(zc.zone, total, zc.free, zc.reserved, zc.confirmed, zc.locked, total)
        }.recover {
          case e: Exception =>
            log.error(s"Zone $zone status request failed: ${e.getMessage}")
            zone.toString -> Supervisor.ZoneStatus(zone.toString, 0, 0, 0, 0, 0, 0)
        }
      }
      Future.sequence(zoneFutures).map(_.toMap).map(ZoneStatuses.apply).pipeTo(replyTo)
  }

  private def nameToZone(name: String): Zone = name match {
    case "VIP"       => VIP
    case "Or"        => Or
    case "Standard"  => Standard
    case "Populaire" => Populaire
    case other       => throw new IllegalArgumentException(s"Zone inconnue: $other")
  }
}
