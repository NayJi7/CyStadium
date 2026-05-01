package cystadium.petri

import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpec

final class PetriNetAnalyzerSpec extends AnyWordSpec with Matchers {
  private val free = Place("Free_A1", "Seat A1 free")
  private val reserved = Place("Reserved_A1", "Seat A1 reserved")
  private val confirmed = Place("Confirmed_A1", "Seat A1 confirmed")
  private val waiting = Place("WaitingForPayment_b1", "waiting b1")
  private val paymentSuccess = Place("PaymentSuccess_b1", "payment success b1")
  private val paymentFailed = Place("PaymentFailed_b1", "payment failed b1")

  private val reserve = Transition("T_reserve", "reserve")
  private val paySuccess = Transition("T_pay_success", "pay success")
  private val payFail = Transition("T_pay_fail", "pay fail")
  private val confirm = Transition("T_confirm", "confirm")
  private val release = Transition("T_release", "release")

  private val net = PetriNet(
    places = Set(free, reserved, confirmed, waiting, paymentSuccess, paymentFailed),
    transitions = Set(reserve, paySuccess, payFail, confirm, release),
    arcs = Set(
      Arc("Free_A1", "T_reserve"),
      Arc("T_reserve", "Reserved_A1"),
      Arc("T_reserve", "WaitingForPayment_b1"),
      Arc("WaitingForPayment_b1", "T_pay_success"),
      Arc("T_pay_success", "PaymentSuccess_b1"),
      Arc("WaitingForPayment_b1", "T_pay_fail"),
      Arc("T_pay_fail", "PaymentFailed_b1"),
      Arc("Reserved_A1", "T_confirm"),
      Arc("PaymentSuccess_b1", "T_confirm"),
      Arc("T_confirm", "Confirmed_A1"),
      Arc("T_confirm", "PaymentSuccess_b1"),
      Arc("Reserved_A1", "T_release"),
      Arc("PaymentFailed_b1", "T_release"),
      Arc("T_release", "Free_A1")
    )
  )

  private val m0 = Marking(Map("Free_A1" -> 1))

  "PetriNet" should {
    "enable reserve in initial marking and fire transitions" in {
      net.isEnabled(reserve, m0) shouldBe true
      val m1 = net.fire(reserve, m0)
      m1.get("Free_A1") shouldBe 0
      m1.get("Reserved_A1") shouldBe 1
      m1.get("WaitingForPayment_b1") shouldBe 1
    }
  }

  "PetriNetAnalyzer" should {
    "compute reachable graph and structural properties" in {
      val reachable = PetriNetAnalyzer.reachabilityGraph(net, m0)
      reachable.nonEmpty shouldBe true

      PetriNetAnalyzer.isBounded(net, m0) shouldBe true
      PetriNetAnalyzer.isLive(net, m0) shouldBe true
      PetriNetAnalyzer.isDeadlockFree(net, m0) shouldBe false
    }

    "check invariants and LTL helpers through report" in {
      val seatIds = Set("A1")
      val bookingToSeats = Map("b1" -> Set("A1"))
      val seatToBooking = Map("A1" -> "b1")
      val waitingPlaces = Set("WaitingForPayment_b1")

      val report = PetriNetAnalyzer.analyze(
        net = net,
        m0 = m0,
        invariants = Map(
          "S1_no_double_reservation" -> LTLProperties.noDoubleReservation(seatIds),
          "S2_single_status" -> LTLProperties.seatHasExactlyOneStatus(seatIds),
          "S3_confirmed_implies_paid" -> LTLProperties.confirmedImpliesPaymentSuccess(seatToBooking)
        ),
        ltlChecks = Map(
          "S4_failed_eventually_release" -> (reachable =>
            LTLProperties.paymentFailedEventuallyReleased(reachable, bookingToSeats)),
          "V1_waiting_eventually_resolves" -> (reachable =>
            LTLProperties.waitingEventuallyResolves(reachable, waitingPlaces)),
          "V2_waiting_clears" -> (reachable =>
            LTLProperties.waitingEventuallyResolves(reachable, waitingPlaces))
        )
      )

      report.reachableStates should be > 0
      report.invariantsOk("S1_no_double_reservation") shouldBe true
      report.invariantsOk("S2_single_status") shouldBe true
      report.invariantsOk("S3_confirmed_implies_paid") shouldBe true
      report.ltlOk("S4_failed_eventually_release") shouldBe true
      report.ltlOk("V1_waiting_eventually_resolves") shouldBe true
      report.ltlOk("V2_waiting_clears") shouldBe true
      report.ltlOk("V3_no_unexpected_deadlock") shouldBe false
      report.unexpectedDeadlocks should be > 0
    }

    "analyze the CyStadium model with three seats and two concurrent clients" in {
      val (cystadiumNet, initialMarking) = CyStadiumPetriModel.build()

      val terminalPredicate: Marking => Boolean = marking =>
        CyStadiumPetriModel.seatIds.forall(seatId => marking.get(s"Reserved_$seatId") == 0) &&
          CyStadiumPetriModel.bookingIds.forall { bookingId =>
            marking.get(s"WaitingForPayment_$bookingId") == 0 &&
            marking.get(s"PaymentFailed_$bookingId") == 0
          }

      val report = PetriNetAnalyzer.analyze(
        net = cystadiumNet,
        m0 = initialMarking,
        invariants = Map(
          "S1_no_double_reservation" -> LTLProperties.noDoubleReservation(CyStadiumPetriModel.seatIds),
          "S2_single_status" -> LTLProperties.seatHasExactlyOneStatus(CyStadiumPetriModel.seatIds),
          "S3_confirmed_implies_paid" ->
            LTLProperties.confirmedImpliesSomePaymentSuccess(CyStadiumPetriModel.seatToBookings)
        ),
        ltlChecks = Map(
          "S4_failed_eventually_release" -> (reachable =>
            LTLProperties.paymentFailedEventuallyReleased(reachable, CyStadiumPetriModel.bookingToSeats)),
          "V1_waiting_eventually_resolves" -> (reachable =>
            LTLProperties.waitingEventuallyResolves(reachable, CyStadiumPetriModel.waitingPlaces)),
          "V2_waiting_clears" -> (reachable =>
            LTLProperties.waitingEventuallyResolves(reachable, CyStadiumPetriModel.waitingPlaces))
        ),
        terminalPredicate = terminalPredicate
      )

      report.reachableStates should be > 1
      report.bounded shouldBe true
      report.invariantsOk.values.forall(identity) shouldBe true
      report.ltlOk("S4_failed_eventually_release") shouldBe true
      report.ltlOk("V1_waiting_eventually_resolves") shouldBe true
      report.ltlOk("V2_waiting_clears") shouldBe true
      report.ltlOk("V3_no_unexpected_deadlock") shouldBe true
      report.terminalDeadlocks should be > 0
      report.unexpectedDeadlocks shouldBe 0
    }
  }
}
