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
import slick.jdbc.H2Profile.api._
import akka.http.scaladsl.testkit.RouteTestTimeout

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
  implicit val routeTestTimeout: RouteTestTimeout = RouteTestTimeout(5.seconds)

  private val h2Db = Database.forURL("jdbc:h2:mem:business_test;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=FALSE", driver = "org.h2.Driver")
    .asInstanceOf[slick.jdbc.PostgresProfile.backend.Database]

  // Initialise le schéma minimal pour les tests
  private def initDb(): Unit = {
    import cystadium.db.Tables
    import scala.concurrent.Await
    import scala.concurrent.duration._
    val setup = DBIO.seq(
      sqlu"""CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY,
        home_team VARCHAR(100) NOT NULL,
        away_team VARCHAR(100) NOT NULL,
        match_date TIMESTAMP NOT NULL,
        stadium VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'open',
        city VARCHAR(100),
        stage VARCHAR(50),
        highlight BOOLEAN DEFAULT FALSE
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS zones (
        id UUID PRIMARY KEY,
        match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
        name VARCHAR(20) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        capacity INT NOT NULL
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS seats (
        id UUID PRIMARY KEY,
        zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
        label VARCHAR(10) NOT NULL,
        "row" CHAR(1) NOT NULL,
        number INT NOT NULL CHECK (number > 0),
        status VARCHAR(20) DEFAULT 'free',
        UNIQUE(zone_id, "row", number)
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(40) UNIQUE NOT NULL,
        password_hash VARCHAR(120),
        is_admin BOOLEAN DEFAULT FALSE
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS reservations (
        id UUID PRIMARY KEY,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
        match_id UUID REFERENCES matches(id) ON DELETE RESTRICT,
        status VARCHAR(20) DEFAULT 'pending',
        total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS reservation_seats (
        reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
        seat_id UUID REFERENCES seats(id) ON DELETE RESTRICT,
        PRIMARY KEY (reservation_id, seat_id)
      )""",
      sqlu"""CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY,
        reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )"""
    )
    Await.result(h2Db.run(setup.transactionally), 5.seconds)
  }

  initDb()

  private def mkRoutes(
    sm: akka.actor.ActorRef,
    matchManagerMap: Map[MatchId, akka.actor.ActorRef] = Map.empty,
    reservationHandler: akka.actor.ActorRef = system.deadLetters,
    paymentGateway: akka.actor.ActorRef = system.deadLetters,
    timeout: FiniteDuration = 2.seconds
  ) = new Routes(
    sessionManager     = sm,
    supervisor         = system.deadLetters,
    matchManager       = system.deadLetters,
    matchManagerMap    = matchManagerMap,
    reservationHandler = reservationHandler,
    paymentGateway     = paymentGateway,
    db                 = h2Db,
    askTimeoutDuration = timeout
  ).all

  private def login(routes: akka.http.scaladsl.server.Route): String = {
    val body = Json.obj("username" -> Json.fromString("alice"), "password" -> Json.fromString("secret"))
    Post("/api/auth/login", body) ~> routes ~> check {
      responseAs[Json].hcursor.get[String]("session_id").toOption.get
    }
  }

  "GET /api/matches/:id" should {
    "renvoyer le match avec ses zones" in {
      val matchId = UUID.randomUUID()
      val zoneId  = UUID.randomUUID()
      import scala.concurrent.Await
      import scala.concurrent.duration._
      val setup = DBIO.seq(
        sqlu"""INSERT INTO matches (id, home_team, away_team, match_date, stadium, status)
          VALUES (${matchId.toString}, 'France', 'Brésil', '2026-06-14 20:00:00', 'Test Stadium', 'open')""",
        sqlu"""INSERT INTO zones (id, match_id, name, price, capacity)
          VALUES (${zoneId.toString}, ${matchId.toString}, 'VIP', 500.0, 10)"""
      )
      Await.result(h2Db.run(setup.transactionally), 2.seconds)

      val sm     = system.actorOf(Props(new StubAuth))
      val routes = mkRoutes(sm)

      Get(s"/api/matches/$matchId") ~> routes ~> check {
        status shouldBe StatusCodes.OK
        val j = responseAs[Json]
        j.hcursor.get[String]("id").toOption shouldBe Some(matchId.toString)
        j.hcursor.downField("zones").get[Int]("VIP").toOption shouldBe Some(10)
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
      val routes = mkRoutes(sm, reservationHandler = fake)
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
      val routes = mkRoutes(sm, reservationHandler = fake)
      val sid  = login(routes)

      Post(s"/api/reservations/$reservationId/pay", Payloads.initPayment(reservationId, 50.0))
        .addHeader(RawHeader("X-Session-Id", sid)) ~> routes ~> check {
          status shouldBe StatusCodes.GatewayTimeout
        }
    }
  }

  "Timeout sur un acteur indisponible" should {
    "retourner 200 OK avec zones vides (graceful degradation)" in {
      val matchId = UUID.randomUUID()
      val zoneId  = UUID.randomUUID()
      import scala.concurrent.Await
      import scala.concurrent.duration._
      val setup = DBIO.seq(
        sqlu"""INSERT INTO matches (id, home_team, away_team, match_date, stadium, status)
          VALUES (${matchId.toString}, 'France', 'Brésil', '2026-06-14 20:00:00', 'Test Stadium', 'open')""",
        sqlu"""INSERT INTO zones (id, match_id, name, price, capacity)
          VALUES (${zoneId.toString}, ${matchId.toString}, 'VIP', 500.0, 10)"""
      )
      Await.result(h2Db.run(setup.transactionally), 2.seconds)

      val result  = AvailabilityResult(matchId, Map(VIP -> 10))
      val fake = system.actorOf(Props(new FakeResponder({
        case CheckAvailability(id) if id == matchId => result
      })))

      val sm      = system.actorOf(Props(new StubAuth))
      val routes  = mkRoutes(sm, matchManagerMap = Map(matchId -> fake), timeout = 500.millis)
      // On arrête le fake pour simuler un crash
      system.stop(fake)
      Get(s"/api/matches/$matchId") ~> routes ~> check {
        status shouldBe StatusCodes.OK
        val j = responseAs[Json]
        j.hcursor.get[String]("id").toOption shouldBe Some(matchId.toString)
        j.hcursor.downField("zones").get[Int]("VIP").toOption shouldBe None
      }
    }
  }
}
