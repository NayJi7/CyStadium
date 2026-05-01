package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, OneForOneStrategy, Props, SupervisorStrategy}
import cystadium.db.Tables
import cystadium.protocol._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.Await
import scala.concurrent.duration._
import scala.util.Try

object Supervisor {
  def props(
    db: slick.jdbc.PostgresProfile.backend.Database,
    sessionTtl: FiniteDuration
  ): Props = Props(new Supervisor(db, sessionTtl))

  case object GetRefs
  case class Refs(
    sessionManager:     ActorRef,
    matchManagers:      Map[MatchId, ActorRef],
    seatAllocator:      ActorRef,
    reservationHandler: ActorRef,
    paymentGateway:     ActorRef
  )
}

class Supervisor(
  db: slick.jdbc.PostgresProfile.backend.Database,
  sessionTtl: FiniteDuration
) extends Actor with ActorLogging {

  import Supervisor._

  override val supervisorStrategy: SupervisorStrategy =
    OneForOneStrategy() { case _ => SupervisorStrategy.Restart }

  private val sessionManager = context.actorOf(
    SessionManager.props(sessionTtl, db),
    "session-manager"
  )

  private val paymentGateway = context.actorOf(
    PaymentGateway.props(),
    "payment-gateway"
  )

  private val seatAllocator = context.actorOf(
    SeatAllocator.props(),
    "seat-allocator"
  )

  private val matchManagers: Map[MatchId, ActorRef] = {
    val matchIds = Try(
      Await.result(db.run(Tables.matches.map(_.id).result), 15.seconds)
    ).getOrElse {
      log.warning("Impossible de charger les matchs depuis la DB au démarrage")
      Seq.empty
    }
    matchIds.map { id =>
      id -> context.actorOf(MatchManager.props(id, db), s"match-manager-$id")
    }.toMap
  }

  private val reservationHandler = context.actorOf(
    ReservationHandler.props(
      sessionManager  = sessionManager,
      seatAllocator   = seatAllocator,
      seatRefResolver = new ActorRefSeatRefResolver(matchManagers),
      repository      = new cystadium.db.SlickReservationRepository(db),
      reservationTtl  = 10.minutes,
      responseTimeout = 5.seconds
    ),
    "reservation-handler"
  )

  log.info("Supervisor démarré : {} matchs", matchManagers.size)

  override def receive: Receive = {
    case GetRefs =>
      sender() ! Refs(sessionManager, matchManagers, seatAllocator, reservationHandler, paymentGateway)
  }
}

private class ActorRefSeatRefResolver(matchManagers: Map[MatchId, ActorRef])
    extends ReservationHandler.SeatRefResolver {

  import akka.pattern.ask
  import akka.util.Timeout
  import scala.concurrent.Await
  import scala.concurrent.duration._
  import scala.util.Try

  implicit val timeout: Timeout = Timeout(5.seconds)

  override def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef] =
    matchManagers.get(matchId) match {
      case None => Map.empty
      case Some(mm) =>
        Try(Await.result(
          (mm ? MatchManager.GetSeatRefs(matchId, zone, seatIds)).mapTo[MatchManager.SeatRefsResult],
          6.seconds
        )).map(_.refs).getOrElse(Map.empty)
    }
}
