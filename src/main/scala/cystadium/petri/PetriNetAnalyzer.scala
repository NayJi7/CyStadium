package cystadium.petri

import scala.collection.mutable

final case class AnalysisReport(
    reachableStates: Int,
    bounded: Boolean,
    deadlockFree: Boolean,
    terminalDeadlocks: Int,
    unexpectedDeadlocks: Int,
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

  def deadlocks(net: PetriNet, m0: Marking): Set[Marking] =
    reachabilityGraph(net, m0).filter(m => net.enabledTransitions(m).isEmpty)

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
      ltlChecks: Map[String, Set[Marking] => Boolean] = Map.empty,
      terminalPredicate: Marking => Boolean = _ => false
  ): AnalysisReport = {
    val reachable = reachabilityGraph(net, m0)
    val deadlockStates = reachable.filter(m => net.enabledTransitions(m).isEmpty)
    val terminalDeadlocks = deadlockStates.count(terminalPredicate)
    val unexpectedDeadlocks = deadlockStates.size - terminalDeadlocks
    val deadlockFree = deadlockStates.isEmpty
    val bounded = isBounded(net, m0)
    val live = net.transitions.forall(t => reachable.exists(m => net.isEnabled(t, m)))

    val invariantResults = invariants.map { case (name, predicate) =>
      name -> reachable.forall(predicate)
    }

    val ltlResults = ltlChecks.map { case (name, check) =>
      name -> check(reachable)
    } + ("V3_no_unexpected_deadlock" -> LTLProperties.noUnexpectedDeadlock(unexpectedDeadlocks == 0))

    AnalysisReport(
      reachableStates = reachable.size,
      bounded = bounded,
      deadlockFree = deadlockFree,
      terminalDeadlocks = terminalDeadlocks,
      unexpectedDeadlocks = unexpectedDeadlocks,
      live = live,
      invariantsOk = invariantResults,
      ltlOk = ltlResults
    )
  }
}
