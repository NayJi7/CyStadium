package cystadium.api

import akka.actor.{Actor, Props}
import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.model.headers.RawHeader
import akka.http.scaladsl.testkit.ScalatestRouteTest
import akka.util.Timeout
import cystadium.json.Codecs._
import cystadium.protocol._
import de.heikoseeberger.akkahttpcirce.FailFastCirceSupport._
import io.circe.Json
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

import java.util.UUID
import scala.concurrent.duration._

// Tests des routes auth — on remplace SessionManager par un stub en mémoire
// pour pas dépendre de Supabase pendant les tests d'API.
class AuthRoutesSpec extends AnyWordSpec with Matchers with ScalatestRouteTest {

  implicit val askTimeout: Timeout = Timeout(2.seconds)

  // Stub : accepte alice/secret, refuse le reste. Stocke les sessions en mémoire.
  private class StubSessionManager extends Actor {
    private val knownClient = UUID.randomUUID()
    private var sessions   = Map.empty[UUID, UUID]
    def receive: Receive = {
      case Login("alice", "secret") =>
        val sid = UUID.randomUUID()
        sessions += sid -> knownClient
        sender() ! LoginSuccess(sid, knownClient, "alice")
      case Login(_, _) =>
        sender() ! LoginFailed("invalid_credentials")
      case Register("alice", _, _, _) =>
        sender() ! RegisterFailed("username_or_email_taken")
      case Register(u, _, _, _) =>
        sender() ! RegisterSuccess(UUID.randomUUID(), u)
      case Logout(sid) =>
        sessions -= sid
      case ValidateSession(sid) =>
        sessions.get(sid) match {
          case Some(cid) => sender() ! SessionValid(cid)
          case None      => sender() ! SessionInvalid
        }
    }
  }

  private def newRoutes() = {
    val sm = system.actorOf(Props(new StubSessionManager))
    new Routes(sm, system.deadLetters, system.deadLetters, system.deadLetters, 2.seconds).all
  }

  "POST /api/auth/register" should {
    "retourner 201 + client_id pour un nouveau pseudo" in {
      val routes = newRoutes()
      val body = Json.obj(
        "username" -> Json.fromString("bob"),
        "password" -> Json.fromString("secret123"),
        "email"    -> Json.fromString("bob@example.com"),
        "name"     -> Json.fromString("Bob"),
      )
      Post("/api/auth/register", body) ~> routes ~> check {
        status shouldBe StatusCodes.Created
        responseAs[Json].hcursor.get[String]("client_id").isRight shouldBe true
      }
    }

    "retourner 400 si pseudo déjà pris" in {
      val routes = newRoutes()
      val body = Json.obj(
        "username" -> Json.fromString("alice"),
        "password" -> Json.fromString("secret123"),
        "email"    -> Json.fromString("alice@example.com"),
        "name"     -> Json.fromString("Alice"),
      )
      Post("/api/auth/register", body) ~> routes ~> check {
        status shouldBe StatusCodes.BadRequest
      }
    }
  }

  "POST /api/auth/login" should {
    "retourner 200 + session_id pour des credentials valides" in {
      val routes = newRoutes()
      val body   = Json.obj(
        "username" -> Json.fromString("alice"),
        "password" -> Json.fromString("secret"),
      )
      Post("/api/auth/login", body) ~> routes ~> check {
        status shouldBe StatusCodes.OK
        responseAs[Json].hcursor.get[String]("session_id").isRight shouldBe true
      }
    }

    "retourner 401 pour des credentials invalides" in {
      val routes = newRoutes()
      val body   = Json.obj(
        "username" -> Json.fromString("alice"),
        "password" -> Json.fromString("wrong"),
      )
      Post("/api/auth/login", body) ~> routes ~> check {
        status shouldBe StatusCodes.Unauthorized
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
    "invalider la session" in {
      val sm        = system.actorOf(Props(new StubSessionManager))
      val routesObj = new Routes(sm, system.deadLetters, system.deadLetters, system.deadLetters, 2.seconds)
      val protectedRoute = akka.http.scaladsl.server.Directives.get {
        routesObj.authenticated { _ =>
          akka.http.scaladsl.server.Directives.complete(StatusCodes.OK -> Json.obj("ok" -> Json.True))
        }
      }
      val body = Json.obj(
        "username" -> Json.fromString("alice"),
        "password" -> Json.fromString("secret"),
      )
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
