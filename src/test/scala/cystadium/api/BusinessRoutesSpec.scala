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
import io.circe.syntax._
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

import java.time.Instant
import java.util.UUID
import scala.concurrent.duration._

private object Payloads {
  def reserveSeats(matchId: UUID, zone: String, seatIds: Set[UUID], sessionId: UUID): Json =
    Json.obj(
      "match_id"   -> Json.fromString(matchId.toString),
      "zone"       -> Json.fromString(zone),
      "seat_ids"   -> Json.arr(seatIds.toSeq.map(s => Json.fromString(s.toString)): _*),
      "session_id" -> Json.fromString(sessionId.toString)
    )
  def initPayment(reservationId: UUID, amount: Double): Json =
    Json.obj(
      "reservation_id" -> Json.fromString(reservationId.toString),
      "amount"         -> Json.fromDoubleOrNull(amount)
    )
}

private class FakeResponder(reply: PartialFunction[Any, Any]) extends Actor {
  def receive: Receive = { case msg if reply.isDefinedAt(msg) => sender() ! reply(msg) }
}

private class StubAuth extends Actor {
  private var sessions = Map.empty[UUID, UUID]
  def receive: Receive = {
    case Login(_, _) =>
      val sid = UUID.randomUUID(); val cid = UUID.randomUUID()
      sessions += sid -> cid
      sender() ! LoginSuccess(sid, cid, "test", isAdmin = false)
    case Logout(sid)          => sessions -= sid
    case ValidateSession(sid) =>
      sessions.get(sid) match {
        case Some(cid) => sender() ! SessionValid(cid)
        case None      => sender() ! SessionInvalid
      }
  }
}

class BusinessRoutesSpec extends AnyWordSpec with Matchers with ScalatestRouteTest {

  implicit val askTimeout: Timeout = Timeout(2.seconds)

  // DB null : les routes testées ici n'atteignent pas la DB (acteurs fakés)
  private val noDb = null.asInstanceOf[slick.jdbc.PostgresProfile.backend.Database]

  private def mkRoutes(
    sm: akka.actor.ActorRef,
    matchManagerMap: Map[MatchId, akka.actor.ActorRef] = Map.empty,
    reservationHandler: akka.actor.ActorRef = system.deadLetters,
    paymentGateway: akka.actor.ActorRef = system.deadLetters,
    timeout: FiniteDuration = 2.seconds
  ) = new Routes(
    sessionManager     = sm,
    matchManager       = system.deadLetters,
    matchManagerMap    = matchManagerMap,
    reservationHandler = reservationHandler,
    paymentGateway     = paymentGateway,
    db                 = noDb,
    askTimeoutDuration = timeout
  ).all

  private def login(routes: akka.http.scaladsl.server.Route): String = {
    val body = Json.obj("username" -> Json.fromString("alice"), "password" -> Json.fromString("secret"))
    Post("/api/auth/login", body) ~> routes ~> check {
      responseAs[Json].hcursor.get[String]("session_id").toOption.get
    }
  }

  "GET /api/matches/:id" should {
    "forward CheckAvailability et renvoyer AvailabilityResult" in {
      val matchId = UUID.randomUUID()
      val result  = AvailabilityResult(matchId, Map(VIP -> 10, Standard -> 42))
      val fake = system.actorOf(Props(new FakeResponder({
        case CheckAvailability(id) if id == matchId => result
      })))
      val sm     = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm, matchManagerMap = Map(matchId -> fake))

      Get(s"/api/matches/$matchId") ~> routes ~> check {
        status shouldBe StatusCodes.OK
        val j = responseAs[Json]
        j.hcursor.get[String]("match_id").toOption shouldBe Some(matchId.toString)
        j.hcursor.downField("zones").get[Int]("VIP").toOption shouldBe Some(10)
        j.hcursor.downField("zones").get[Int]("Standard").toOption shouldBe Some(42)
      }
    }
  }

  "POST /api/reservations" should {
    "retourner 401 sans session" in {
      val sm     = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm)
      val body = Payloads.reserveSeats(UUID.randomUUID(), "VIP", Set(UUID.randomUUID()), UUID.randomUUID())
      Post("/api/reservations", body) ~> routes ~> check {
        status shouldBe StatusCodes.Unauthorized
      }
    }

    "retourner 201 + SeatsReserved quand l'handler répond OK" in {
      val reservationId = UUID.randomUUID()
      val seats         = Set(UUID.randomUUID(), UUID.randomUUID())
      val reply         = SeatsReserved(reservationId, seats, total = 99.0, expiresAt = Instant.now().plusSeconds(600))
      val fake = system.actorOf(Props(new FakeResponder({ case _: ReserveSeats => reply })))
      val sm   = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm, reservationHandler = fake)
      val sid  = login(routes)

      val body = Payloads.reserveSeats(UUID.randomUUID(), "VIP", seats, UUID.fromString(sid))
      Post("/api/reservations", body).addHeader(RawHeader("X-Session-Id", sid)) ~> routes ~> check {
        status shouldBe StatusCodes.Created
        responseAs[Json].hcursor.get[String]("reservation_id").toOption shouldBe Some(reservationId.toString)
      }
    }

    "retourner 409 SeatsUnavailable" in {
      val conflict = Set(UUID.randomUUID())
      val fake = system.actorOf(Props(new FakeResponder({ case _: ReserveSeats => SeatsUnavailable(conflict) })))
      val sm   = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm, reservationHandler = fake)
      val sid  = login(routes)

      val body = Payloads.reserveSeats(UUID.randomUUID(), "VIP", Set(UUID.randomUUID()), UUID.fromString(sid))
      Post("/api/reservations", body).addHeader(RawHeader("X-Session-Id", sid)) ~> routes ~> check {
        status shouldBe StatusCodes.Conflict
      }
    }
  }

  "POST /api/reservations/:id/pay" should {
    "mapper PaymentFailed → 402" in {
      val reservationId = UUID.randomUUID()
      val fake = system.actorOf(Props(new FakeResponder({ case _: InitPayment => PaymentFailed(reservationId, "card_declined") })))
      val sm   = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm, paymentGateway = fake)
      val sid  = login(routes)

      Post(s"/api/reservations/$reservationId/pay", Payloads.initPayment(reservationId, 50.0))
        .addHeader(RawHeader("X-Session-Id", sid)) ~> routes ~> check {
          status shouldBe StatusCodes.PaymentRequired
        }
    }

    "mapper PaymentTimeout → 504" in {
      val reservationId = UUID.randomUUID()
      val fake = system.actorOf(Props(new FakeResponder({ case _: InitPayment => PaymentTimeout(reservationId) })))
      val sm   = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm, paymentGateway = fake)
      val sid  = login(routes)

      Post(s"/api/reservations/$reservationId/pay", Payloads.initPayment(reservationId, 50.0))
        .addHeader(RawHeader("X-Session-Id", sid)) ~> routes ~> check {
          status shouldBe StatusCodes.GatewayTimeout
        }
    }
  }

  "Timeout sur un acteur indisponible" should {
    "retourner 503 service_unavailable" in {
      val matchId = UUID.randomUUID()
      val sm      = system.actorOf(Props(new StubAuth))
      val routes  = mkRoutes(sm, matchManagerMap = Map(matchId -> system.deadLetters), timeout = 500.millis)
      Get(s"/api/matches/$matchId") ~> routes ~> check {
        status shouldBe StatusCodes.ServiceUnavailable
      }
    }
  }
}
