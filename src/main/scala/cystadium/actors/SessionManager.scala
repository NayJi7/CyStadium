package cystadium.actors

import akka.actor.{Actor, ActorLogging, Cancellable, Props}
import cystadium.protocol._

import java.time.Instant
import java.util.UUID
import scala.concurrent.duration.FiniteDuration

// ─────────────────────────────────────────────────────────────────────────────
// SessionManager — Adam
// Acteur d'authentification en mémoire.
//   Login(clientId)           → LoginSuccess(sessionId)
//   ValidateSession(sessionId) → SessionValid(clientId) | SessionInvalid
//   Logout(sessionId)          → (rien)
//   SessionExpired(sessionId)  → self, planifié via scheduler après ttl
// ─────────────────────────────────────────────────────────────────────────────

object SessionManager {
  def props(ttl: FiniteDuration): Props = Props(new SessionManager(ttl))

  private final case class SessionEntry(
    clientId:  ClientId,
    expiresAt: Instant,
    timer:     Cancellable
  )
}

class SessionManager(ttl: FiniteDuration) extends Actor with ActorLogging {
  import SessionManager._
  import context.dispatcher

  private var sessions: Map[SessionId, SessionEntry] = Map.empty

  override def receive: Receive = {
    case Login(clientId) =>
      val sessionId = UUID.randomUUID()
      val expiresAt = Instant.now().plusMillis(ttl.toMillis)
      val timer     = context.system.scheduler.scheduleOnce(ttl, self, SessionExpired(sessionId))
      sessions += sessionId -> SessionEntry(clientId, expiresAt, timer)
      log.info("session.open sessionId={} clientId={}", sessionId, clientId)
      sender() ! LoginSuccess(sessionId)

    case ValidateSession(sessionId) =>
      sessions.get(sessionId) match {
        case Some(entry) if entry.expiresAt.isAfter(Instant.now()) =>
          sender() ! SessionValid(entry.clientId)
        case _ =>
          sender() ! SessionInvalid
      }

    case Logout(sessionId) =>
      sessions.get(sessionId).foreach(_.timer.cancel())
      sessions -= sessionId
      log.info("session.close sessionId={}", sessionId)

    case SessionExpired(sessionId) =>
      if (sessions.contains(sessionId)) {
        log.info("session.expire sessionId={}", sessionId)
        sessions -= sessionId
      }
  }

  override def postStop(): Unit =
    sessions.values.foreach(_.timer.cancel())
}
