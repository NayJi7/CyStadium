package cystadium.api

import akka.NotUsed
import akka.actor.{ActorRef, ActorSystem, CoordinatedShutdown}
import akka.http.scaladsl.model.ws.{Message, TextMessage}
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.pattern.ask
import akka.stream.{CompletionStrategy, OverflowStrategy}
import akka.stream.scaladsl.{Flow, Sink, Source}
import akka.util.Timeout
import cystadium.actors.Supervisor
import cystadium.json.Codecs._
import io.circe.syntax._
import io.circe.{Encoder, Json}

import scala.concurrent.duration._
import scala.util.{Failure, Success}

// ─────────────────────────────────────────────────────────────────────────────
// AdminWebSocketHandler — Monitoring temps réel de l'actor system
// Expose GET /ws/admin/monitor
//
// Pousse périodiquement (500ms) l'état complet du système d'acteurs au client.
// Chaque mise à jour inclut:
//   - La hiérarchie d'acteurs (MatchManagers, ZoneManagers, SeatActors)
//   - Les compteurs de sièges par zone (free/reserved/confirmed/locked)
//   - L'état des acteurs top-level (SessionManager, PaymentGateway, etc.)
//   - Des métriques de performance (timestamp, latency)
// ─────────────────────────────────────────────────────────────────────────────

class AdminWebSocketHandler(
    supervisor: ActorRef,
    sessionManager: ActorRef
)(implicit system: ActorSystem, askTimeout: Timeout) {

  import system.dispatcher

  val routes: Route =
    path("admin" / "monitor") {
      get {
        handleWebSocketMessages(monitorFlow())
      }
    }

  private case class MonitorFrame(
      status: Supervisor.ActorStatus,
      latencyMs: Long,
      timestamp: Long
  )

  private implicit val monitorFrameEncoder: Encoder[MonitorFrame] = Encoder.instance { f =>
    Json.obj(
      "type"      -> Json.fromString("status_update"),
      "timestamp" -> Json.fromLong(f.timestamp),
      "latencyMs" -> Json.fromLong(f.latencyMs),
      "data"      -> f.status.asJson
    )
  }

  private def monitorFlow(): Flow[Message, Message, NotUsed] =
    Flow.fromSinkAndSource(Sink.ignore, monitorSource())

  private def monitorSource(): Source[Message, NotUsed] = {
    val completion: PartialFunction[Any, CompletionStrategy] = {
      case CoordinatedShutdown => CompletionStrategy.draining
    }
    val failure: PartialFunction[Any, Throwable] = PartialFunction.empty

    Source
      .actorRef[Any](
        completionMatcher = completion,
        failureMatcher    = failure,
        bufferSize        = 128,
        overflowStrategy  = OverflowStrategy.dropHead
      )
      .mapMaterializedValue { ref =>
        // Lance un timer périodique pour pousser l'état
        system.scheduler.scheduleWithFixedDelay(500.millis, 500.millis) { () =>
          val t0 = System.currentTimeMillis()
          (supervisor ? Supervisor.GetActorStatus).mapTo[Supervisor.ActorStatus].onComplete {
            case Success(status) =>
              val latency = System.currentTimeMillis() - t0
              ref ! MonitorFrame(status, latency, System.currentTimeMillis())
            case Failure(ex) =>
              ref ! Json.obj(
                "type"  -> Json.fromString("error"),
                "error" -> Json.fromString(ex.getMessage)
              )
          }
        }
        NotUsed
      }
      .map {
        case frame: MonitorFrame => TextMessage(frame.asJson.noSpaces)
        case json: Json          => TextMessage(json.noSpaces)
        case other               => TextMessage(other.toString)
      }
  }
}
