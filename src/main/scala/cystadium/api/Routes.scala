package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{ExceptionHandler, MissingHeaderRejection, RejectionHandler, Route}
import akka.pattern.{AskTimeoutException, ask}
import akka.util.Timeout
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._

import java.util.UUID
import scala.concurrent.duration.FiniteDuration
import scala.util.Try

// ─────────────────────────────────────────────────────────────────────────────
// Routes — Adam
// Agrège toutes les routes HTTP et expose les helpers partagés :
//   - authenticated(clientId => Route) : middleware auth via header X-Session-Id
//   - exceptionHandler / rejectionHandler : erreurs uniformes en JSON
// ─────────────────────────────────────────────────────────────────────────────

class Routes(
  sessionManager:     ActorRef,
  matchManager:       ActorRef,
  reservationHandler: ActorRef,
  paymentGateway:     ActorRef,
  askTimeoutDuration: FiniteDuration
)(implicit system: akka.actor.ActorSystem) {
  implicit val askTimeout: Timeout = Timeout(askTimeoutDuration)

  private val authHelper         = new AuthHelper(sessionManager)
  private val authRoutes         = new AuthRoutes(sessionManager, authHelper.authenticated).routes
  private val matchRoutes        = new MatchRoutes(matchManager).routes
  private val reservationRoutes  =
    new ReservationRoutes(reservationHandler, paymentGateway, authHelper.authenticated).routes
  private val wsRoutes           = new WebSocketHandler(system).routes

  val exceptionHandler: ExceptionHandler = ExceptionHandler {
    case _: AskTimeoutException =>
      complete(StatusCodes.ServiceUnavailable -> serviceUnavailable)
  }

  val rejectionHandler: RejectionHandler =
    RejectionHandler.newBuilder()
      .handle {
        case MissingHeaderRejection("X-Session-Id") =>
          complete(StatusCodes.Unauthorized -> unauthorized)
      }
      .handleNotFound(complete(StatusCodes.NotFound -> notFound))
      .result()

  // À utiliser dans les futures routes protégées : authenticated { clientId => ... }
  def authenticated: akka.http.scaladsl.server.Directive1[ClientId] =
    authHelper.authenticated

  val all: Route =
    handleExceptions(exceptionHandler) {
      handleRejections(rejectionHandler) {
        concat(
          pathPrefix("api") {
            concat(authRoutes, matchRoutes, reservationRoutes)
          },
          pathPrefix("ws") { wsRoutes }
        )
      }
    }
}

private[api] class AuthHelper(sessionManager: ActorRef)(implicit askTimeout: Timeout) {
  import akka.http.scaladsl.server.Directives._

  def authenticated: akka.http.scaladsl.server.Directive1[ClientId] =
    headerValueByName("X-Session-Id").flatMap { sidStr =>
      Try(UUID.fromString(sidStr)).toOption match {
        case None =>
          complete(StatusCodes.Unauthorized -> unauthorized)
        case Some(sid) =>
          onSuccess((sessionManager ? ValidateSession(sid)).mapTo[Any]).flatMap {
            case SessionValid(clientId) => provide(clientId)
            case _                      => complete(StatusCodes.Unauthorized -> unauthorized)
          }
      }
    }
}
