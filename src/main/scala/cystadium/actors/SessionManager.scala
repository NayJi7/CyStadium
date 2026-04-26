package cystadium.actors

import akka.actor.{Actor, ActorLogging, Cancellable, Props, Status}
import akka.pattern.pipe
import cystadium.db.Tables
import cystadium.protocol._
import org.mindrot.jbcrypt.BCrypt
import slick.jdbc.PostgresProfile.api._

import java.time.Instant
import java.util.UUID
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration.FiniteDuration
import scala.util.{Failure, Success}

// ─────────────────────────────────────────────────────────────────────────────
// SessionManager — Adam
// Auth pseudo + mot de passe (BCrypt). ClientId reste un UUID interne.
//
//   Register(username, password, email, name)  → RegisterSuccess(clientId) | RegisterFailed
//   Login(username, password)                  → LoginSuccess(sessionId, clientId, username) | LoginFailed
//   Logout(sessionId)                          → (rien)
//   ValidateSession(sessionId)                 → SessionValid(clientId) | SessionInvalid
//   SessionExpired(sessionId)                  → self, planifié via scheduler
// ─────────────────────────────────────────────────────────────────────────────

object SessionManager {
  def props(ttl: FiniteDuration, db: Database): Props =
    Props(new SessionManager(ttl, db))

  private final case class SessionEntry(
    clientId:  ClientId,
    username:  String,
    expiresAt: Instant,
    timer:     Cancellable
  )

  // Réponses internes des futures DB
  private final case class CredentialsCheck(
    requester: akka.actor.ActorRef,
    result:    Either[String, (ClientId, String, Boolean)] // username, isAdmin
  )
  private final case class RegistrationDone(
    requester: akka.actor.ActorRef,
    result:    Either[String, (ClientId, String, Boolean)]
  )
}

class SessionManager(ttl: FiniteDuration, db: Database) extends Actor with ActorLogging {
  import SessionManager._
  import context.dispatcher

  private implicit val ec: ExecutionContext = context.dispatcher

  private var sessions: Map[SessionId, SessionEntry] = Map.empty

  override def receive: Receive = {

    case Register(username, password, email, name) =>
      val u = username.trim
      val requester = sender()
      if (u.isEmpty || password.length < 6 || email.trim.isEmpty || name.trim.isEmpty) {
        requester ! RegisterFailed("invalid_input")
      } else {
        val hash    = BCrypt.hashpw(password, BCrypt.gensalt(10))
        val newId   = UUID.randomUUID()
        val newRow  = cystadium.db.ClientRow(newId, email.trim, name.trim, u, Some(hash), isAdmin = false)
        val insert  = (Tables.clients += newRow).asTry
        db.run(insert).map {
          case Success(_)  => RegistrationDone(requester, Right((newId, u, false)))
          case Failure(ex) =>
            log.error(ex, "auth.register insert failed username={}", u)
            RegistrationDone(requester, Left("username_or_email_taken"))
        }.recover { case ex =>
          log.error(ex, "auth.register db.run failed username={}", u)
          RegistrationDone(requester, Left("db_error"))
        }.pipeTo(self)
      }

    case RegistrationDone(requester, Right((cid, uname, admin))) =>
      log.info("auth.register clientId={} username={} admin={}", cid, uname, admin)
      requester ! RegisterSuccess(cid, uname, admin)

    case RegistrationDone(requester, Left(reason)) =>
      requester ! RegisterFailed(reason)

    case Login(username, password) =>
      val u = username.trim
      val requester = sender()
      if (u.isEmpty || password.isEmpty) {
        requester ! LoginFailed("invalid_credentials")
      } else {
        val q = Tables.clients.filter(_.username === u).take(1).result.headOption
        db.run(q).map {
          case Some(row) =>
            val ok = row.passwordHash.exists(h => BCrypt.checkpw(password, h))
            if (ok) CredentialsCheck(requester, Right((row.id, row.username, row.isAdmin)))
            else    CredentialsCheck(requester, Left("invalid_credentials"))
          case None =>
            CredentialsCheck(requester, Left("invalid_credentials"))
        }.recover { case _ => CredentialsCheck(requester, Left("db_error")) }
          .pipeTo(self)
      }

    case CredentialsCheck(requester, Right((cid, uname, admin))) =>
      val sessionId = UUID.randomUUID()
      val expiresAt = Instant.now().plusMillis(ttl.toMillis)
      val timer     = context.system.scheduler.scheduleOnce(ttl, self, SessionExpired(sessionId))
      sessions += sessionId -> SessionEntry(cid, uname, expiresAt, timer)
      log.info("session.open sessionId={} clientId={} username={} admin={}", sessionId, cid, uname, admin)
      requester ! LoginSuccess(sessionId, cid, uname, admin)

    case CredentialsCheck(requester, Left(reason)) =>
      requester ! LoginFailed(reason)

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

    case Status.Failure(ex) =>
      log.error(ex, "SessionManager: future en échec")
  }

  override def postStop(): Unit =
    sessions.values.foreach(_.timer.cancel())
}
