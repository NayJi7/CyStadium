package cystadium.petri

final case class Place(id: String, name: String)

final case class Transition(
    id: String,
    name: String,
    guard: Marking => Boolean = _ => true
)

final case class Arc(from: String, to: String, weight: Int = 1)

final case class Marking(tokens: Map[String, Int]) {
  def get(placeId: String): Int =
    tokens.getOrElse(placeId, 0)

  def add(placeId: String, n: Int): Marking = {
    val updated = get(placeId) + n
    if (updated == 0) copy(tokens = tokens - placeId)
    else copy(tokens = tokens.updated(placeId, updated))
  }

  def remove(placeId: String, n: Int): Marking =
    add(placeId, -n)
}

final case class PetriNet(
    places: Set[Place],
    transitions: Set[Transition],
    arcs: Set[Arc]
) {
  private val placeIds = places.map(_.id)
  private val transitionIds = transitions.map(_.id)
  private val transitionsById = transitions.map(t => t.id -> t).toMap

  // Input arcs: Place -> Transition
  private val pre: Map[String, List[Arc]] =
    arcs.filter(arc => placeIds.contains(arc.from) && transitionIds.contains(arc.to))
      .groupBy(_.to)
      .view
      .mapValues(_.toList)
      .toMap

  // Output arcs: Transition -> Place
  private val post: Map[String, List[Arc]] =
    arcs.filter(arc => transitionIds.contains(arc.from) && placeIds.contains(arc.to))
      .groupBy(_.from)
      .view
      .mapValues(_.toList)
      .toMap

  def isEnabled(t: Transition, m: Marking): Boolean =
    t.guard(m) && pre.getOrElse(t.id, Nil).forall(arc => m.get(arc.from) >= arc.weight)

  def fire(t: Transition, m: Marking): Marking = {
    require(isEnabled(t, m), s"Transition ${t.id} is not enabled for marking $m")

    val consumed = pre.getOrElse(t.id, Nil).foldLeft(m) { (acc, arc) =>
      acc.remove(arc.from, arc.weight)
    }

    post.getOrElse(t.id, Nil).foldLeft(consumed) { (acc, arc) =>
      acc.add(arc.to, arc.weight)
    }
  }

  def enabledTransitions(m: Marking): Set[Transition] =
    transitions.filter(isEnabled(_, m))

  def transitionById(id: String): Option[Transition] =
    transitionsById.get(id)
}

object CyStadiumPetriModel {
  val seatIds: Set[String] = Set("A1", "A2", "A3")
  val clientIds: Set[String] = Set("C1", "C2")

  val bookingIds: Set[String] =
    for {
      clientId <- clientIds
      seatId <- seatIds
    } yield bookingId(clientId, seatId)

  val seatToBookings: Map[String, Set[String]] =
    seatIds.map(seatId => seatId -> clientIds.map(clientId => bookingId(clientId, seatId))).toMap

  val bookingToSeats: Map[String, Set[String]] =
    bookingIds.map(booking => booking -> Set(seatFromBooking(booking))).toMap

  val waitingPlaces: Set[String] =
    bookingIds.map(booking => s"WaitingForPayment_$booking")

  def bookingId(clientId: String, seatId: String): String =
    s"${clientId}_$seatId"

  def seatFromBooking(bookingId: String): String =
    bookingId.split("_").last

  def build(): (PetriNet, Marking) = {
    val seatPlaces = seatIds.flatMap { seatId =>
      Set(
        Place(s"Free_$seatId", s"Seat $seatId free"),
        Place(s"Reserved_$seatId", s"Seat $seatId reserved"),
        Place(s"Confirmed_$seatId", s"Seat $seatId confirmed")
      )
    }

    val clientPlaces =
      clientIds.map(clientId => Place(s"ClientActive_$clientId", s"Client $clientId active"))

    val bookingPlaces = bookingIds.flatMap { booking =>
      Set(
        Place(s"WaitingForPayment_$booking", s"Waiting payment for $booking"),
        Place(s"PaymentSuccess_$booking", s"Payment success for $booking"),
        Place(s"PaymentFailed_$booking", s"Payment failed for $booking"),
        Place(s"TransactionDone_$booking", s"Transaction done for $booking")
      )
    }

    val reserveTransitions = for {
      clientId <- clientIds
      seatId <- seatIds
    } yield Transition(s"T_reserve_${clientId}_$seatId", s"$clientId reserves $seatId")

    val paymentTransitions = bookingIds.flatMap { booking =>
      Set(
        Transition(s"T_pay_success_$booking", s"payment succeeds for $booking"),
        Transition(s"T_pay_fail_$booking", s"payment fails for $booking"),
        Transition(s"T_pay_timeout_$booking", s"payment times out for $booking")
      )
    }

    val finalizationTransitions = bookingIds.flatMap { booking =>
      Set(
        Transition(s"T_confirm_$booking", s"confirm $booking"),
        Transition(s"T_release_failed_$booking", s"release failed $booking"),
        Transition(s"T_release_timeout_$booking", s"release timeout $booking")
      )
    }

    val reserveArcs = for {
      clientId <- clientIds
      seatId <- seatIds
      booking = bookingId(clientId, seatId)
      transition = s"T_reserve_${clientId}_$seatId"
      arc <- Set(
        Arc(s"Free_$seatId", transition),
        Arc(s"ClientActive_$clientId", transition),
        Arc(transition, s"Reserved_$seatId"),
        Arc(transition, s"WaitingForPayment_$booking")
      )
    } yield arc

    val paymentArcs = bookingIds.flatMap { booking =>
      Set(
        Arc(s"WaitingForPayment_$booking", s"T_pay_success_$booking"),
        Arc(s"T_pay_success_$booking", s"PaymentSuccess_$booking"),
        Arc(s"WaitingForPayment_$booking", s"T_pay_fail_$booking"),
        Arc(s"T_pay_fail_$booking", s"PaymentFailed_$booking"),
        Arc(s"WaitingForPayment_$booking", s"T_pay_timeout_$booking"),
        Arc(s"T_pay_timeout_$booking", s"PaymentFailed_$booking")
      )
    }

    val finalizationArcs = bookingIds.flatMap { booking =>
      val seatId = seatFromBooking(booking)
      Set(
        Arc(s"Reserved_$seatId", s"T_confirm_$booking"),
        Arc(s"PaymentSuccess_$booking", s"T_confirm_$booking"),
        Arc(s"T_confirm_$booking", s"Confirmed_$seatId"),
        Arc(s"T_confirm_$booking", s"PaymentSuccess_$booking"),
        Arc(s"T_confirm_$booking", s"TransactionDone_$booking"),
        Arc(s"Reserved_$seatId", s"T_release_failed_$booking"),
        Arc(s"PaymentFailed_$booking", s"T_release_failed_$booking"),
        Arc(s"T_release_failed_$booking", s"Free_$seatId"),
        Arc(s"T_release_failed_$booking", s"TransactionDone_$booking"),
        Arc(s"Reserved_$seatId", s"T_release_timeout_$booking"),
        Arc(s"PaymentFailed_$booking", s"T_release_timeout_$booking"),
        Arc(s"T_release_timeout_$booking", s"Free_$seatId"),
        Arc(s"T_release_timeout_$booking", s"TransactionDone_$booking")
      )
    }

    val net = PetriNet(
      places = seatPlaces ++ clientPlaces ++ bookingPlaces,
      transitions = reserveTransitions ++ paymentTransitions ++ finalizationTransitions,
      arcs = reserveArcs ++ paymentArcs ++ finalizationArcs
    )

    val m0 = Marking(
      seatIds.map(seatId => s"Free_$seatId" -> 1).toMap ++
        clientIds.map(clientId => s"ClientActive_$clientId" -> 1).toMap
    )

    (net, m0)
  }
}
