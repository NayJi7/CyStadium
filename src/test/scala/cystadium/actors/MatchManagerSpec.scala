package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.wordspec.AnyWordSpecLike
import cystadium.protocol._
import java.util.UUID
import scala.concurrent.duration._

class MatchManagerSpec extends TestKit(ActorSystem("MatchManagerTest"))
  with ImplicitSender
  with AnyWordSpecLike
  with BeforeAndAfterAll {

  override def beforeAll(): Unit = {
    val f = new java.io.File(".env")
    if (f.isFile) {
      val src = scala.io.Source.fromFile(f, "UTF-8")
      try src.getLines().foreach { raw =>
        val line = raw.trim
        if (line.nonEmpty && !line.startsWith("#")) {
          val eq = line.indexOf('=')
          if (eq > 0) {
            val key = line.substring(0, eq).trim
            var value = line.substring(eq + 1).trim
            if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\""))
              value = value.substring(1, value.length - 1)
            if (System.getenv(key) == null && System.getProperty(key) == null)
              System.setProperty(key, value)
          }
        }
      } finally src.close()
    }
  }

  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "Un MatchManager" should {

    // Test d'intégration : nécessite Supabase accessible et seed V4 appliqué.
    // Lancer manuellement : sbt "testOnly cystadium.actors.MatchManagerSpec"
    "créer la hiérarchie complète et répondre aux demandes de disponibilité" ignore {
      // ID réel présent en DB (seed V4)
      val matchId = UUID.fromString("a1000000-0000-0000-0000-000000000001")

      val matchManager = system.actorOf(MatchManager.props(matchId, cystadium.db.Database.db), "match-manager-test")

      // Retry jusqu'à ce que le MatchManager ait chargé les zones depuis la DB
      awaitAssert({
        matchManager ! CheckAvailability(matchId)
        val response = expectMsgType[AvailabilityResult](1.second)
        assert(response.matchId == matchId)
        assert(response.zones.contains(VIP))
        assert(response.zones.contains(Or))
        assert(response.zones.contains(Standard))
        assert(response.zones.contains(Populaire))
        println(s"Succès ! Zones trouvées : ${response.zones.keys.mkString(", ")}")
      }, 15.seconds, 1.second)
    }
  }
}