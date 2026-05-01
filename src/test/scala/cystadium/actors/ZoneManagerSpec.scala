package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.wordspec.AnyWordSpecLike
import cystadium.protocol._
import java.util.UUID

class ZoneManagerSpec extends TestKit(ActorSystem("ZoneManagerTest"))
  with ImplicitSender
  with AnyWordSpecLike
  with BeforeAndAfterAll {

  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "Un ZoneManager" should {

    "regrouper les disponibilités de ses sièges " in {
      val matchId = UUID.randomUUID()
      
      //  fausses données pour simuler la base de données
      // 2 sièges libres (Free) et 1 siège déjà réservé (Reserved)
      val seatsData = List(
        (UUID.randomUUID(), 500.0, Free),
        (UUID.randomUUID(), 500.0, Free),
        (UUID.randomUUID(), 500.0, Reserved(UUID.randomUUID(), UUID.randomUUID(), java.time.Instant.now()))
      )

      // on instancie  ZoneManager pour la zone VIP avec ces données
      val zoneManager = system.actorOf(ZoneManager.props(matchId, VIP, seatsData))

      Thread.sleep(500)

      // on lui demande combien de sièges sont disponibles
      zoneManager ! CheckAvailability(matchId)

      // 4. Vérification : le ZoneManager doit interroger ses enfants et nous répondre "2"
      expectMsg(2)
      
      println("Succès ! Le ZoneManager a bien compté 2 sièges libres sur 3.")
    }
  }
}