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
// AuthRoutes — Adam
// POST /api/auth/login  : body Login → LoginSuccess
// POST /api/auth/logout : header X-Session-Id → 204 No Content
// ─────────────────────────────────────────────────────────────────────────────

class AuthRoutes(sessionManager: ActorRef)(implicit askTimeout: Timeout) {

  val routes: Route =
    pathPrefix("auth") {
      concat(
        path("login") {
          post {
            entity(as[Login]) { login =>
              onSuccess((sessionManager ? login).mapTo[LoginSuccess]) { ok =>
                complete(StatusCodes.OK -> ok)
              }
            }
          }
        },
        path("logout") {
          post {
            headerValueByName("X-Session-Id") { sidStr =>
              scala.util.Try(java.util.UUID.fromString(sidStr)).toOption match {
                case Some(sid) =>
                  sessionManager ! Logout(sid)
                  complete(StatusCodes.NoContent)
                case None =>
                  complete(StatusCodes.Unauthorized -> unauthorized)
              }
            }
          }
        }
      )
    }
}
