package cystadium.api

import akka.http.scaladsl.model.ws.TextMessage
import akka.http.scaladsl.testkit.{ScalatestRouteTest, WSProbe}
import cystadium.protocol._
import io.circe.parser._
import org.scalatest.concurrent.Eventually
import org.scalatest.matchers.should.Matchers
import org.scalatest.time.{Millis, Seconds, Span}
import org.scalatest.wordspec.AnyWordSpec

import java.util.UUID

class WebSocketHandlerSpec
  extends AnyWordSpec
  with Matchers
  with ScalatestRouteTest
  with Eventually {

  implicit override val patienceConfig: PatienceConfig =
    PatienceConfig(timeout = Span(2, Seconds), interval = Span(50, Millis))

  private def newRoutes = new WebSocketHandler(system).routes

  "GET /matches/:id/live" should {

    "pousser en JSON les SeatStatusEvent du bon match" in {
      val matchId  = UUID.randomUUID()
      val otherMatch = UUID.randomUUID()
      val seatId   = UUID.randomUUID()
      val client   = WSProbe()

      WS(s"/matches/$matchId/live", client.flow) ~> newRoutes ~> check {
        isWebSocketUpgrade shouldBe true

        // Laisser le temps à la souscription eventStream de s'établir
        Thread.sleep(100)

        system.eventStream.publish(SeatStatusEvent(otherMatch, seatId, Free))
        system.eventStream.publish(SeatStatusEvent(matchId, seatId, Free))

        val msg = client.expectMessage()
        msg shouldBe a[TextMessage.Strict]
        val json = parse(msg.asInstanceOf[TextMessage.Strict].text).toOption.get
        json.hcursor.get[String]("match_id").toOption shouldBe Some(matchId.toString)
        json.hcursor.get[String]("seat_id").toOption  shouldBe Some(seatId.toString)
        json.hcursor.get[String]("status").toOption   shouldBe Some("free")

        client.sendCompletion()
      }
    }
  }
}
