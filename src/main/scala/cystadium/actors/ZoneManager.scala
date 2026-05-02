package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, OneForOneStrategy, Props}
import akka.actor.SupervisorStrategy._
import akka.pattern.ask
import akka.util.Timeout
import cystadium.protocol._
import scala.concurrent.duration._
import scala.concurrent.Future

// pour creer des zone manager
object ZoneManager {
  def props(matchId: MatchId, zone: Zone, seatsData: List[(SeatId, Double, SeatStatus)]): Props =
    Props(new ZoneManager(matchId, zone, seatsData))

  case class GetSeatRefs(seatIds: Set[SeatId])
  case class SeatRefsResult(refs: Map[SeatId, ActorRef], zone: Zone)
  case object GetStatusCounts
  case class StatusCounts(zone: String, free: Int, reserved: Int, confirmed: Int, locked: Int)
}

class ZoneManager(matchId: MatchId, zone: Zone, seatsData: List[(SeatId, Double, SeatStatus)]) 
  extends Actor with ActorLogging {

// tps max que zonemanager va att qd il pose une question aux sieges, fais tourner les futures, et stocke les addresses de ts les sieges d'une zone
  implicit val timeout: Timeout = Timeout(5.seconds)
  import context.dispatcher

  var seatRefs: Map[SeatId, ActorRef] = Map.empty

// si un siege plante, on redemarre que ce siege la
  override val supervisorStrategy = OneForOneStrategy() {
    case _: Exception => Restart
  }

// prend la liste des sieges et va creer des seat actor pr chaque siege
  override def preStart(): Unit = {
    seatRefs = seatsData.map { case (id, price, status) =>
      val actor = context.actorOf(SeatActor.props(matchId, id, zone, price, status), s"seat-$id")
      id -> actor
    }.toMap
    log.info(s"Zone $zone : ${seatRefs.size} sièges créés.")
  }

  def receive: Receive = {
    // Mission unique du ZoneManager : voir  les disponibilités
    case CheckAvailability(_) =>
    // contient l'ad de qui a posé la question et sauvegarde l'ad pr rep plus tard
      val replyTo = sender()
      
      // On demande son état à chaque SeatActor
      val futures = seatRefs.values.map(ref => (ref ? GetSeatStatus).mapTo[SeatStatusResponse])

      // On compte ceux qui répondent "Free"
      Future.sequence(futures).map { responses =>
        val freeCount = responses.count(_.status == Free)
        replyTo ! freeCount
      }

    case ZoneManager.GetSeatRefs(seatIds) =>
      val found = seatRefs.filter { case (id, _) => seatIds.contains(id) }
      sender() ! ZoneManager.SeatRefsResult(found, zone)

    case ZoneManager.GetStatusCounts =>
      val replyTo = sender()
      // Ask every SeatActor for its status and count the results
      val futures = seatRefs.values.map(ref =>
        (ref ? GetSeatStatus).mapTo[SeatStatusResponse]
      )
      Future.sequence(futures).recover {
        case _: Exception => Nil
      }.map { responses =>
        val free = responses.count(_.status == Free)
        val reserved = responses.count(_.status.isInstanceOf[Reserved])
        val confirmed = responses.count(_.status.isInstanceOf[Confirmed])
        val locked = responses.count(_.status == Locked)
        replyTo ! ZoneManager.StatusCounts(zone.toString, free, reserved, confirmed, locked)
      }
  }
}