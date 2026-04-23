package cystadium.api

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.testkit.ScalatestRouteTest
import akka.util.Timeout
import cystadium.actors.SessionManager
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.Json
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

import java.util.UUID
import scala.concurrent.duration._

class AuthRoutesSpec extends AnyWordSpec with Matchers with ScalatestRouteTest {

  implicit val askTimeout: Timeout = Timeout(2.seconds)

  private def newRoutes() = {
    val sm = system.actorOf(SessionManager.props(15.minutes))
    new Routes(sm, system.deadLetters, system.deadLetters, system.deadLetters, 2.seconds).all
  }

  "POST /api/auth/login" should {
    "retourner 200 + session_id" in {
      val routes   = newRoutes()
      val clientId = UUID.randomUUID()
      val body     = Json.obj("client_id" -> Json.fromString(clientId.toString))
      Post("/api/auth/login", body) ~> routes ~> check {
        status shouldBe StatusCodes.OK
        val resp = responseAs[Json]
        resp.hcursor.get[String]("session_id").isRight shouldBe true
      }
    }
  }

  "POST /api/auth/logout" should {
    "retourner 204 avec un X-Session-Id valide" in {
      val routes = newRoutes()
      Post("/api/auth/logout").addHeader(RawHeader("X-Session-Id", UUID.randomUUID().toString)) ~>
        routes ~> check {
          status shouldBe StatusCodes.NoContent
        }
    }

    "retourner 401 si X-Session-Id absent" in {
      val routes = newRoutes()
      Post("/api/auth/logout") ~> routes ~> check {
        status shouldBe StatusCodes.Unauthorized
      }
    }

    "retourner 401 si X-Session-Id mal formé" in {
      val routes = newRoutes()
      Post("/api/auth/logout").addHeader(RawHeader("X-Session-Id", "pas-un-uuid")) ~>
        routes ~> check {
          status shouldBe StatusCodes.Unauthorized
        }
    }
  }

  "Un login suivi d'un logout" should {
    "invalider la session (preuve via directive authenticated)" in {
      val sm        = system.actorOf(SessionManager.props(15.minutes))
      val routesObj = new Routes(sm, system.deadLetters, system.deadLetters, system.deadLetters, 2.seconds)
      // Route de test qui exige un login
      val protectedRoute = akka.http.scaladsl.server.Directives.get {
        routesObj.authenticated { _ =>
          akka.http.scaladsl.server.Directives.complete(StatusCodes.OK -> Json.obj("ok" -> Json.True))
        }
      }

      val clientId = UUID.randomUUID()
      val body     = Json.obj("client_id" -> Json.fromString(clientId.toString))
      val sid = Post("/api/auth/login", body) ~> routesObj.all ~> check {
        status shouldBe StatusCodes.OK
        responseAs[Json].hcursor.get[String]("session_id").toOption.get
      }

      Get("/protected").addHeader(RawHeader("X-Session-Id", sid)) ~> protectedRoute ~> check {
        status shouldBe StatusCodes.OK
      }

      Post("/api/auth/logout").addHeader(RawHeader("X-Session-Id", sid)) ~> routesObj.all ~> check {
        status shouldBe StatusCodes.NoContent
      }

      Get("/protected").addHeader(RawHeader("X-Session-Id", sid)) ~> protectedRoute ~> check {
        status shouldBe StatusCodes.Unauthorized
      }
    }
  }
}
