package cystadium.actors

import akka.actor.{Actor, ActorLogging, Props}
import cystadium.protocol._

import java.util.UUID
import scala.concurrent.duration._

object PaymentGateway {
  sealed trait PaymentOutcome
  case object Success extends PaymentOutcome
  case object Failed extends PaymentOutcome
  case object Timeout extends PaymentOutcome
  case object GetPendingPaymentCount

  type OutcomePicker = () => PaymentOutcome
  type TransactionIdGenerator = () => String

  def defaultOutcomePicker(): PaymentOutcome = {
    val p = scala.util.Random.nextDouble()
    if (p < 0.8d) Success
    else if (p < 0.9d) Failed
    else Timeout
  }

  def defaultTransactionIdGenerator(): String =
    s"tx-${UUID.randomUUID()}"

  def props(
      paymentTimeout: FiniteDuration = 10.seconds,
      successDelay: FiniteDuration = 150.millis,
      failedDelay: FiniteDuration = 150.millis,
      outcomePicker: OutcomePicker = () => defaultOutcomePicker(),
      transactionIdGenerator: TransactionIdGenerator = () => defaultTransactionIdGenerator()
  ): Props =
    Props(
      new PaymentGateway(
        paymentTimeout = paymentTimeout,
        successDelay = successDelay,
        failedDelay = failedDelay,
        outcomePicker = outcomePicker,
        transactionIdGenerator = transactionIdGenerator
      )
    )
}

final class PaymentGateway(
    paymentTimeout: FiniteDuration,
    successDelay: FiniteDuration,
    failedDelay: FiniteDuration,
    outcomePicker: PaymentGateway.OutcomePicker,
    transactionIdGenerator: PaymentGateway.TransactionIdGenerator
) extends Actor
    with ActorLogging {

  import PaymentGateway._
  import context.dispatcher

  private var pendingCount: Int = 0

  override def receive: Receive = {
    case InitPayment(reservationId, amount) =>
      val replyTo = sender()
      log.info(s"[DEBUG] PaymentGateway: InitPayment id=$reservationId amount=$amount")
      pendingCount += 1
      outcomePicker() match {
        case Success =>
          context.system.scheduler.scheduleOnce(successDelay) {
            log.info(s"[DEBUG] PaymentGateway: sending PaymentSuccess for $reservationId")
            pendingCount = Math.max(0, pendingCount - 1)
            replyTo ! PaymentSuccess(reservationId, transactionIdGenerator())
          }
        case Failed =>
          context.system.scheduler.scheduleOnce(failedDelay) {
            log.info(s"[DEBUG] PaymentGateway: sending PaymentFailed for $reservationId")
            pendingCount = Math.max(0, pendingCount - 1)
            replyTo ! PaymentFailed(reservationId, s"payment_declined_for_${amount.formatted("%.2f")}")
          }
        case Timeout =>
          context.system.scheduler.scheduleOnce(successDelay) {
            log.info(s"[DEBUG] PaymentGateway: sending PaymentTimeout for $reservationId")
            pendingCount = Math.max(0, pendingCount - 1)
            replyTo ! PaymentTimeout(reservationId)
          }
      }

    case GetPendingPaymentCount =>
      sender() ! pendingCount
  }
}
