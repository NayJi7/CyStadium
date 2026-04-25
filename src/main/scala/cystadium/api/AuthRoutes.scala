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
import io.circe.Json

// ─────────────────────────────────────────────────────────────────────────────
// AuthRoutes — Adam
// POST /api/auth/register : { username, password, email, name } → 201 RegisterSuccess
// POST /api/auth/login    : { username, password }              → 200 LoginSuccess | 401 LoginFailed
// POST /api/auth/logout   : header X-Session-Id                 → 204
// GET  /api/auth/me       : header X-Session-Id                 → 200 { client_id }
// ─────────────────────────────────────────────────────────────────────────────

class AuthRoutes(
  sessionManager: ActorRef,
  authenticated:  akka.http.scaladsl.server.Directive1[ClientId]
)(implicit askTimeout: Timeout) {

  val routes: Route =
    pathPrefix("auth") {
      concat(
        path("register") {
          post {
            entity(as[Register]) { req =>
              onSuccess((sessionManager ? req).mapTo[Any]) {
                case ok: RegisterSuccess => complete(StatusCodes.Created -> ok)
                case RegisterFailed(reason) =>
                  complete(StatusCodes.BadRequest -> errorJson(reason))
                case _ =>
                  complete(StatusCodes.ServiceUnavailable -> serviceUnavailable)
              }
            }
          }
        },
        path("login") {
          post {
            entity(as[Login]) { login =>
              onSuccess((sessionManager ? login).mapTo[Any]) {
                case ok: LoginSuccess => complete(StatusCodes.OK -> ok)
                case LoginFailed(reason) =>
                  complete(StatusCodes.Unauthorized -> errorJson(reason))
                case _ =>
                  complete(StatusCodes.ServiceUnavailable -> serviceUnavailable)
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
        },
        path("me") {
          get {
            authenticated { clientId =>
              complete(StatusCodes.OK -> Json.obj("client_id" -> Json.fromString(clientId.toString)))
            }
          }
        }
      )
    }
}
