package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.wordspec.AnyWordSpecLike
import cystadium.protocol._
import java.util.UUID

class MatchManagerSpec extends TestKit(ActorSystem("MatchManagerTest"))
  with ImplicitSender
  with AnyWordSpecLike
  with BeforeAndAfterAll {

  // pour eteindre le système d'acteurs à la fin des tests
  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "Un MatchManager" should {

    "créer la hiérarchie complète et répondre aux demandes de disponibilité" in {
      // prépare un ID de match fictif
      val matchId = UUID.randomUUID()
      
      // lancement du matchmanager
      val matchManager = system.actorOf(MatchManager.props(matchId), "match-manager-test")

      Thread.sleep(1000)

      // on demande les disponibilités pour ce match
      matchManager ! CheckAvailability(matchId)

      // 4. Vérification : on s'attend à recevoir un AvailabilityResult
      // ce message contient les stats des 4 zones (VIP, Or, Standard, Populaire)
      val response = expectMsgType[AvailabilityResult]
      
      assert(response.matchId == matchId)
      // On vérifie que les zones ont bien été creees par  MatchManager
      assert(response.zones.contains(VIP))
      assert(response.zones.contains(Or))
      assert(response.zones.contains(Standard))
      assert(response.zones.contains(Populaire))
      
      println(s"Succès ! Zones trouvées : ${response.zones.keys.mkString(", ")}")
    }
  }
}