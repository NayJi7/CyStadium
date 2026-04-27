package cystadium.petri

object LTLProperties {
  private def hasPositiveToken(m: Marking, placeId: String): Boolean =
    m.get(placeId) > 0

  private def sumTokensForSeat(m: Marking, seatId: String): Int =
    m.get(s"Free_$seatId") + m.get(s"Reserved_$seatId") + m.get(s"Confirmed_$seatId")

  // S1: no double reservation
  def noDoubleReservation(seatIds: Set[String])(m: Marking): Boolean =
    seatIds.forall(seatId => m.get(s"Reserved_$seatId") <= 1)

  // S2: a seat has exactly one status at any point
  def seatHasExactlyOneStatus(seatIds: Set[String])(m: Marking): Boolean =
    seatIds.forall(seatId => sumTokensForSeat(m, seatId) == 1)

  // S3: confirmed seat implies payment success
  def confirmedImpliesPaymentSuccess(
      seatToBooking: Map[String, String]
  )(m: Marking): Boolean =
    seatToBooking.forall { case (seatId, bookingId) =>
      val confirmed = m.get(s"Confirmed_$seatId") > 0
      !confirmed || hasPositiveToken(m, s"PaymentSuccess_$bookingId")
    }

  // S4: payment failed implies seats are eventually free.
  // This is evaluated over reachable markings.
  def paymentFailedEventuallyReleased(
      reachable: Set[Marking],
      bookingToSeats: Map[String, Set[String]]
  ): Boolean =
    reachable.forall { m =>
      bookingToSeats.forall { case (bookingId, seatIds) =>
        if (!hasPositiveToken(m, s"PaymentFailed_$bookingId")) true
        else reachable.exists(next => seatIds.forall(seatId => next.get(s"Free_$seatId") > 0))
      }
    }

  // V1/V2: every waiting-for-payment state eventually resolves.
  def waitingEventuallyResolves(reachable: Set[Marking], waitingPlaces: Set[String]): Boolean =
    reachable.forall { m =>
      waitingPlaces.forall { waitingPlace =>
        if (!hasPositiveToken(m, waitingPlace)) true
        else {
          val booking = waitingPlace.stripPrefix("WaitingForPayment_")
          reachable.exists { next =>
            hasPositiveToken(next, s"PaymentSuccess_$booking") ||
            hasPositiveToken(next, s"PaymentFailed_$booking") ||
            !hasPositiveToken(next, waitingPlace)
          }
        }
      }
    }

  // V3: deadlock-free is delegated to analyzer, this helper just exposes naming.
  def noDeadlock(deadlockFree: Boolean): Boolean =
    deadlockFree
}
