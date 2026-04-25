package cystadium

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import cystadium.actors.SessionManager
import cystadium.api.Routes

import java.util.concurrent.TimeUnit
import scala.concurrent.Await
import scala.concurrent.duration.{Duration, FiniteDuration}
import scala.util.{Failure, Success}

// ─────────────────────────────────────────────────────────────────────────────
// Main — Adam
// Boot ActorSystem → crée le SessionManager → démarre le serveur HTTP.
// Les autres acteurs (MatchManager, ReservationHandler, PaymentGateway...)
// seront créés par le Supervisor collectif et injectés dans Routes.
// ─────────────────────────────────────────────────────────────────────────────

object Main {
  def main(args: Array[String]): Unit = {
    implicit val system: ActorSystem = ActorSystem("CyStadium")
    import system.dispatcher

    val config        = system.settings.config.getConfig("cystadium")
    val host          = config.getString("host")
    val port          = config.getInt("port")
    val sessionTtl    = toScala(config.getDuration("session-ttl"))
    val askTimeout    = toScala(config.getDuration("ask-timeout"))

    val sessionManager = system.actorOf(SessionManager.props(sessionTtl, cystadium.db.Database.db), "session-manager")

    // Acteurs des autres équipes — pas encore créés, branchés via le Supervisor
    // collectif. En attendant, `deadLetters` fait timeout → 503 service_unavailable.
    val matchManager       = system.deadLetters
    val reservationHandler = system.deadLetters
    val paymentGateway     = system.deadLetters

    val routes = new Routes(
      sessionManager     = sessionManager,
      matchManager       = matchManager,
      reservationHandler = reservationHandler,
      paymentGateway     = paymentGateway,
      askTimeoutDuration = askTimeout
    ).all

    Http().newServerAt(host, port).bind(routes).onComplete {
      case Success(b) =>
        system.log.info("HTTP serveur lancé sur {}", b.localAddress)
      case Failure(ex) =>
        system.log.error(ex, "Échec du binding HTTP, arrêt")
        system.terminate()
    }

    Await.result(system.whenTerminated, Duration.Inf)
  }

  private def toScala(d: java.time.Duration): FiniteDuration =
    FiniteDuration(d.toMillis, TimeUnit.MILLISECONDS)
}
