package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.pattern.ask
import akka.util.Timeout
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._

// ─────────────────────────────────────────────────────────────────────────────
// MatchRoutes — Adam
// GET /api/matches/{matchId} → CheckAvailability(matchId) → AvailabilityResult
// Le ActorRef matchManager sera fourni par le Supervisor collectif
// (équipe Eléonore/Inès) une fois MatchManager prêt.
// ─────────────────────────────────────────────────────────────────────────────

class MatchRoutes(matchManager: ActorRef)(implicit askTimeout: Timeout) {

  val routes: Route =
    pathPrefix("matches") {
      path(JavaUUID) { matchId =>
        get {
          onSuccess((matchManager ? CheckAvailability(matchId)).mapTo[AvailabilityResult]) { r =>
            complete(StatusCodes.OK -> r)
          }
        }
      }
    }
}
