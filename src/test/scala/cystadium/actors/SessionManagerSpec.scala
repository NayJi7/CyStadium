package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.util.UUID
import scala.concurrent.duration._

class SessionManagerSpec
  extends TestKit(ActorSystem("SessionManagerSpec"))
  with ImplicitSender
  with AnyWordSpecLike
  with Matchers
  with BeforeAndAfterAll {

  override def afterAll(): Unit = TestKit.shutdownActorSystem(system)

  "SessionManager" should {

    "répondre LoginSuccess à Login et valider ensuite la session" in {
      val actor    = system.actorOf(SessionManager.props(15.minutes))
      val clientId = UUID.randomUUID()
      actor ! Login(clientId)
      val sid = expectMsgPF() { case LoginSuccess(s) => s }
      actor ! ValidateSession(sid)
      expectMsg(SessionValid(clientId))
    }

    "répondre SessionInvalid pour un sessionId inconnu" in {
      val actor = system.actorOf(SessionManager.props(15.minutes))
      actor ! ValidateSession(UUID.randomUUID())
      expectMsg(SessionInvalid)
    }

    "expirer automatiquement une session après le TTL" in {
      val actor    = system.actorOf(SessionManager.props(200.millis))
      val clientId = UUID.randomUUID()
      actor ! Login(clientId)
      val sid = expectMsgPF() { case LoginSuccess(s) => s }
      awaitAssert({
        actor ! ValidateSession(sid)
        expectMsg(SessionInvalid)
      }, max = 2.seconds, interval = 100.millis)
    }

    "invalider la session après Logout" in {
      val actor    = system.actorOf(SessionManager.props(15.minutes))
      val clientId = UUID.randomUUID()
      actor ! Login(clientId)
      val sid = expectMsgPF() { case LoginSuccess(s) => s }
      actor ! Logout(sid)
      actor ! ValidateSession(sid)
      expectMsg(SessionInvalid)
    }
  }
}
