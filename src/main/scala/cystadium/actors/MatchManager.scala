package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, Props}
import akka.pattern.pipe
import akka.pattern.ask
import akka.util.Timeout
import cystadium.protocol._
import scala.concurrent.Future
import scala.concurrent.duration._
import java.util.UUID

//crée un match manager et (re)démarre l'acteur
object MatchManager {
  def props(matchId: MatchId): Props = Props(new MatchManager(matchId))
}

class MatchManager(matchId: MatchId) extends Actor with ActorLogging {

  import context.dispatcher
  var zoneManagers: Map[Zone, ActorRef] = Map.empty

  private case class InitialDataLoaded(data: List[(SeatId, Zone, Double, SeatStatus)])

  // on demande à la bdd les données des sieges du match
  override def preStart(): Unit = {
    log.info(s"MatchManager $matchId : Initialisation de la hiérarchie...")
    
    val dbRequest: Future[List[(SeatId, Zone, Double, SeatStatus)]] = Future.successful(
      List(
        // On crée 3 sièges fictifs pour tester (1 Libre, 1 Réservé, 1 Autre) --> a remplacer avec la bdd
        (UUID.randomUUID(), VIP, 500.0, Free),
        (UUID.randomUUID(), VIP, 500.0, Reserved(UUID.randomUUID(), UUID.randomUUID(), java.time.Instant.now())),
        (UUID.randomUUID(), Or, 250.0, Free)
      )
    )

    // On envoie le résultat à l'acteur lui-même via le pattern pipeTo quand la requete est terminée comme ca le manager reste libre pour d'autres taches
    dbRequest.map(InitialDataLoaded).pipeTo(self)
  }

  def receive: Receive = {
    // création des ZoneManagers
    case InitialDataLoaded(seats) =>
      val seatsByZone = seats.groupBy(_._2)

      // Création des ZoneManagers un pr chaque cat (VIP, Or, Standard, Populaire)
      zoneManagers = Seq(VIP, Or, Standard, Populaire).map { zType =>
        val zoneData = seatsByZone.getOrElse(zType, Nil).map(s => (s._1, s._3, s._4))
        // On instancie le ZoneManager qui va lui-même créer les SeatActor
        val ref = context.actorOf(ZoneManager.props(matchId, zType, zoneData), s"zone-$zType")
        zType -> ref
      }.toMap

      log.info(s"Hiérarchie restaurée : ${zoneManagers.size} zones prêtes.")

    //  vérification de disponibilité aux zones
    case CheckAvailability(mId) if mId == matchId =>
      val replyTo = sender()
      implicit val t: Timeout = Timeout(5.seconds)

      // On interroge chaque zone en parallèle
      val zoneFutures = zoneManagers.map { case (z, ref) =>
        (ref ? CheckAvailability(mId)).mapTo[Int].map(count => z -> count)
      }

      // On attend les résultats et on répond
      Future.sequence(zoneFutures).map { results =>
        replyTo ! AvailabilityResult(matchId, results.toMap)
      }
  }
}