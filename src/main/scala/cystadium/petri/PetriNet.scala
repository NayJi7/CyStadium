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
