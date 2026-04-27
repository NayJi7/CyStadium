package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{TestKit, TestProbe}
import com.typesafe.config.ConfigFactory
import cystadium.protocol._
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

import java.util.UUID
import scala.concurrent.duration._

final class PaymentGatewaySpec
    extends TestKit(ActorSystem("PaymentGatewaySpec", ConfigFactory.parseString("akka.loglevel = WARNING")))
    with AnyWordSpecLike
    with Matchers
    with BeforeAndAfterAll {

  override def afterAll(): Unit =
    TestKit.shutdownActorSystem(system)

  "PaymentGateway" should {
    "return PaymentSuccess asynchronously when outcome is success" in {
      val gateway = system.actorOf(
        PaymentGateway.props(
          paymentTimeout = 400.millis,
          successDelay = 50.millis,
          failedDelay = 50.millis,
          outcomePicker = () => PaymentGateway.Success
        )
      )
      val requester = TestProbe()
      val reservationId = UUID.randomUUID()

      requester.send(gateway, InitPayment(reservationId, 1000.0))
      val response = requester.expectMsgType[PaymentSuccess](500.millis)
      response.reservationId shouldBe reservationId
      response.transactionId should startWith("tx-")
    }

    "return PaymentFailed asynchronously when outcome is failed" in {
      val gateway = system.actorOf(
        PaymentGateway.props(
          paymentTimeout = 400.millis,
          successDelay = 50.millis,
          failedDelay = 50.millis,
          outcomePicker = () => PaymentGateway.Failed
        )
      )
      val requester = TestProbe()
      val reservationId = UUID.randomUUID()

      requester.send(gateway, InitPayment(reservationId, 500.0))
      val response = requester.expectMsgType[PaymentFailed](500.millis)
      response.reservationId shouldBe reservationId
      response.reason should include("payment_declined")
    }

    "return PaymentTimeout after configured timeout when outcome is timeout" in {
      val gateway = system.actorOf(
        PaymentGateway.props(
          paymentTimeout = 120.millis,
          successDelay = 50.millis,
          failedDelay = 50.millis,
          outcomePicker = () => PaymentGateway.Timeout
        )
      )
      val requester = TestProbe()
      val reservationId = UUID.randomUUID()

      requester.send(gateway, InitPayment(reservationId, 250.0))
      requester.expectMsg(400.millis, PaymentTimeout(reservationId))
    }
  }
}
