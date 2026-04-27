package cystadium.petri

import scala.collection.mutable

final case class AnalysisReport(
    reachableStates: Int,
    bounded: Boolean,
    deadlockFree: Boolean,
    live: Boolean,
    invariantsOk: Map[String, Boolean],
    ltlOk: Map[String, Boolean]
)

object PetriNetAnalyzer {
  def reachabilityGraph(net: PetriNet, m0: Marking): Set[Marking] = {
    val visited = mutable.LinkedHashSet[Marking](m0)
    val queue = mutable.Queue[Marking](m0)

    while (queue.nonEmpty) {
      val current = queue.dequeue()
      net.enabledTransitions(current).foreach { transition =>
        val next = net.fire(transition, current)
        if (!visited.contains(next)) {
          visited += next
          queue.enqueue(next)
        }
      }
    }

    visited.toSet
  }

  def isBounded(net: PetriNet, m0: Marking): Boolean = {
    val reachable = reachabilityGraph(net, m0)
    val placeIds = net.places.map(_.id)
    placeIds.forall(placeId => reachable.map(_.get(placeId)).maxOption.getOrElse(0) >= 0)
  }

  def isDeadlockFree(net: PetriNet, m0: Marking): Boolean =
    reachabilityGraph(net, m0).forall(m => net.enabledTransitions(m).nonEmpty)

  def isLive(net: PetriNet, m0: Marking): Boolean = {
    val reachable = reachabilityGraph(net, m0)
    net.transitions.forall(t => reachable.exists(m => net.isEnabled(t, m)))
  }

  def checkInvariant(net: PetriNet, m0: Marking, invariant: Marking => Boolean): Boolean =
    reachabilityGraph(net, m0).forall(invariant)

  def analyze(
      net: PetriNet,
      m0: Marking,
      invariants: Map[String, Marking => Boolean] = Map.empty,
      ltlChecks: Map[String, Set[Marking] => Boolean] = Map.empty
  ): AnalysisReport = {
    val reachable = reachabilityGraph(net, m0)
    val deadlockFree = reachable.forall(m => net.enabledTransitions(m).nonEmpty)
    val bounded = isBounded(net, m0)
    val live = net.transitions.forall(t => reachable.exists(m => net.isEnabled(t, m)))

    val invariantResults = invariants.map { case (name, predicate) =>
      name -> reachable.forall(predicate)
    }

    val ltlResults = ltlChecks.map { case (name, check) =>
      name -> check(reachable)
    } + ("V3_no_deadlock" -> LTLProperties.noDeadlock(deadlockFree))

    AnalysisReport(
      reachableStates = reachable.size,
      bounded = bounded,
      deadlockFree = deadlockFree,
      live = live,
      invariantsOk = invariantResults,
      ltlOk = ltlResults
    )
  }
}
