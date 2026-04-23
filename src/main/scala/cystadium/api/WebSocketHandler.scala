package cystadium.api

import akka.NotUsed
import akka.actor.{ActorSystem, CoordinatedShutdown}
import akka.http.scaladsl.model.ws.{Message, TextMessage}
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.stream.{CompletionStrategy, OverflowStrategy}
import akka.stream.scaladsl.{Flow, Sink, Source}
import cystadium.json.Codecs._
import cystadium.protocol._
import io.circe.syntax._

// ─────────────────────────────────────────────────────────────────────────────
// WebSocketHandler — Adam
// Expose GET /ws/matches/{matchId}/live
// Écoute l'EventStream Akka (SeatStatusEvent) et forward chaque événement
// concernant le match en JSON au client.
//
// Convention : les messages entrants du client sont ignorés (flux serveur→client
// unidirectionnel).
// ─────────────────────────────────────────────────────────────────────────────

class WebSocketHandler(system: ActorSystem) {

  val routes: Route =
    pathPrefix("matches" / JavaUUID / "live") { matchId =>
      get {
        handleWebSocketMessages(liveFlow(matchId))
      }
    }

  private def liveFlow(matchId: MatchId): Flow[Message, Message, NotUsed] =
    Flow.fromSinkAndSource(Sink.ignore, eventSource(matchId))

  private def eventSource(matchId: MatchId): Source[Message, NotUsed] = {
    val completion: PartialFunction[Any, CompletionStrategy] = {
      case CoordinatedShutdown => CompletionStrategy.draining
    }
    val failure: PartialFunction[Any, Throwable] = PartialFunction.empty

    Source
      .actorRef[SeatStatusEvent](
        completionMatcher = completion,
        failureMatcher    = failure,
        bufferSize        = 64,
        overflowStrategy  = OverflowStrategy.dropHead
      )
      .mapMaterializedValue { ref =>
        system.eventStream.subscribe(ref, classOf[SeatStatusEvent])
        NotUsed
      }
      .filter(_.matchId == matchId)
      .map(ev => TextMessage(ev.asJson.noSpaces))
  }
}
