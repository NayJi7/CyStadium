package cystadium

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.pattern.ask
import akka.util.Timeout
import cystadium.actors.Supervisor
import cystadium.api.Routes

import java.util.concurrent.TimeUnit
import scala.concurrent.Await
import scala.concurrent.duration.{Duration, DurationInt, FiniteDuration}
import scala.util.{Failure, Success}

object Main {
  def main(args: Array[String]): Unit = {
    loadDotEnv()
    implicit val system: ActorSystem = ActorSystem("CyStadium")
    import system.dispatcher

    val config      = system.settings.config.getConfig("cystadium")
    val host        = config.getString("host")
    val port        = config.getInt("port")
    val sessionTtl  = toScala(config.getDuration("session-ttl"))
    val askTimeout  = toScala(config.getDuration("ask-timeout"))
    implicit val timeout: Timeout = Timeout(30.seconds)

    val supervisor = system.actorOf(
      Supervisor.props(cystadium.db.Database.db, sessionTtl),
      "supervisor"
    )

    val refs = Await.result(
      (supervisor ? Supervisor.GetRefs).mapTo[Supervisor.Refs],
      30.seconds
    )

    val routes = new Routes(
      sessionManager     = refs.sessionManager,
      matchManager       = refs.matchManagers.headOption.map(_._2).getOrElse(system.deadLetters),
      matchManagerMap    = refs.matchManagers,
      reservationHandler = refs.reservationHandler,
      paymentGateway     = refs.paymentGateway,
      db                 = cystadium.db.Database.db,
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

  private def loadDotEnv(): Unit = {
    val f = new java.io.File(".env")
    if (!f.isFile) return
    val src = scala.io.Source.fromFile(f, "UTF-8")
    try {
      src.getLines().foreach { raw =>
        val line = raw.trim
        if (line.nonEmpty && !line.startsWith("#")) {
          val eq = line.indexOf('=')
          if (eq > 0) {
            val key = line.substring(0, eq).trim
            var value = line.substring(eq + 1).trim
            if (value.length >= 2 &&
              ((value.startsWith("\"") && value.endsWith("\"")) ||
               (value.startsWith("'") && value.endsWith("'"))))
              value = value.substring(1, value.length - 1)
            if (System.getenv(key) == null && System.getProperty(key) == null)
              System.setProperty(key, value)
          }
        }
      }
    } finally src.close()
  }
}
