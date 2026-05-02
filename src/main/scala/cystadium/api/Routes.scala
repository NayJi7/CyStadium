package cystadium.api

import akka.actor.ActorRef
import akka.http.scaladsl.model.headers.{`Access-Control-Allow-Credentials`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Origin`, `Access-Control-Max-Age`, Origin}
import akka.http.scaladsl.model.{HttpMethods, StatusCodes}
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

class Routes(
  sessionManager:     ActorRef,
  supervisor:         ActorRef,
  matchManager:       ActorRef,
  matchManagerMap:    Map[MatchId, ActorRef],
  reservationHandler: ActorRef,
  paymentGateway:     ActorRef,
  db:                 slick.jdbc.PostgresProfile.backend.Database,
  askTimeoutDuration: FiniteDuration
)(implicit system: akka.actor.ActorSystem) {

  implicit val askTimeout: Timeout = Timeout(askTimeoutDuration)
  import system.dispatcher

  private val authHelper        = new AuthHelper(sessionManager)
  private val authRoutes        = new AuthRoutes(sessionManager, authHelper.authenticated, db).routes
  private val matchRoutes       = new MatchRoutes(matchManager, matchManagerMap, db).routes
  private val reservationRoutes = new ReservationRoutes(reservationHandler, paymentGateway, db, authHelper.authenticated).routes
  private val adminRoutes       = new AdminRoutes(sessionManager, supervisor, matchManagerMap, db).routes
  private val wsRoutes          = new WebSocketHandler(system).routes
  private val adminWsRoutes     = new AdminWebSocketHandler(supervisor, sessionManager).routes

  val exceptionHandler: ExceptionHandler = ExceptionHandler {
    case _: AskTimeoutException =>
      complete(StatusCodes.ServiceUnavailable -> serviceUnavailable)
  }

  val rejectionHandler: RejectionHandler =
    RejectionHandler.newBuilder()
      .handle { case MissingHeaderRejection("X-Session-Id") =>
        complete(StatusCodes.Unauthorized -> unauthorized)
      }
      .handleNotFound(complete(StatusCodes.NotFound -> notFound))
      .result()

  def authenticated: akka.http.scaladsl.server.Directive1[ClientId] =
    authHelper.authenticated

  val all: Route =
    cors {
      handleExceptions(exceptionHandler) {
        handleRejections(rejectionHandler) {
          concat(
            pathPrefix("api") {
              concat(authRoutes, matchRoutes, reservationRoutes, adminRoutes)
            },
            pathPrefix("ws") { concat(wsRoutes, adminWsRoutes) }
          )
        }
      }
    }

  private val corsAllowHeaders =
    `Access-Control-Allow-Headers`("Content-Type", "X-Session-Id", "Authorization")
  private val corsAllowMethods = `Access-Control-Allow-Methods`(
    HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT, HttpMethods.PATCH, HttpMethods.DELETE, HttpMethods.OPTIONS
  )
  private val corsMaxAge = `Access-Control-Max-Age`(3600)

  private def cors(inner: Route): Route =
    optionalHeaderValueByType(Origin) { originOpt =>
      val allowOrigin = originOpt
        .flatMap(_.origins.headOption)
        .map(o => `Access-Control-Allow-Origin`(o))
        .getOrElse(`Access-Control-Allow-Origin`.*)

      respondWithHeaders(allowOrigin, corsAllowHeaders, corsAllowMethods, `Access-Control-Allow-Credentials`(true)) {
        options { respondWithHeader(corsMaxAge) { complete(StatusCodes.OK) } } ~ inner
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
