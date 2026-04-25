package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike
import slick.jdbc.PostgresProfile.api._

import java.util.UUID
import scala.concurrent.duration._

// SessionManager — tests des chemins ne nécessitant pas la DB.
// Les flows Login/Register de bout en bout sont couverts en intégration
// (cf. AuthRoutesSpec qui utilise un stub SessionManager).
class SessionManagerSpec
  extends TestKit(ActorSystem("SessionManagerSpec"))
  with ImplicitSender
  with AnyWordSpecLike
  with Matchers
  with BeforeAndAfterAll {

  override def afterAll(): Unit = TestKit.shutdownActorSystem(system)

  // Database non utilisée par les chemins testés ici (validation purement synchrone).
  private val stubDb: Database = null

  "SessionManager" should {

    "répondre SessionInvalid pour un sessionId inconnu" in {
      val actor = system.actorOf(SessionManager.props(15.minutes, stubDb))
      actor ! ValidateSession(UUID.randomUUID())
      expectMsg(SessionInvalid)
    }

    "rejeter Login avec credentials vides sans toucher la DB" in {
      val actor = system.actorOf(SessionManager.props(15.minutes, stubDb))
      actor ! Login("", "")
      expectMsg(LoginFailed("invalid_credentials"))
    }

    "rejeter Register avec entrées invalides sans toucher la DB" in {
      val actor = system.actorOf(SessionManager.props(15.minutes, stubDb))
      actor ! Register("", "short", "", "")
      expectMsg(RegisterFailed("invalid_input"))
    }

    "ignorer Logout d'un sessionId inconnu sans planter" in {
      val actor = system.actorOf(SessionManager.props(15.minutes, stubDb))
      actor ! Logout(UUID.randomUUID())
      // pas de réponse attendue, on vérifie juste que l'acteur est encore vivant
      actor ! ValidateSession(UUID.randomUUID())
      expectMsg(SessionInvalid)
    }
  }
}
