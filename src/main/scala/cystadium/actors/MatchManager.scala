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
  case class SeatRefsResult(refs: Map[SeatId, ActorRef])

  private case class InitialDataLoaded(data: List[(SeatId, Zone, Double, SeatStatus)])
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
  }

  private def nameToZone(name: String): Zone = name match {
    case "VIP"       => VIP
    case "Or"        => Or
    case "Standard"  => Standard
    case "Populaire" => Populaire
    case other       => throw new IllegalArgumentException(s"Zone inconnue: $other")
  }
}
