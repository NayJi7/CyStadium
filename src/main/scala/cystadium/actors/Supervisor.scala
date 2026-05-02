package cystadium.actors

import akka.actor.{Actor, ActorLogging, ActorRef, OneForOneStrategy, PoisonPill, Props, SupervisorStrategy}
import akka.pattern.{ask, pipe}
import akka.util.Timeout
import cystadium.db.Tables
import cystadium.protocol._
import slick.jdbc.PostgresProfile.api._

import scala.concurrent.Await
import scala.concurrent.{ExecutionContext, Future}
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
  case class ReloadMatch(matchId: MatchId)
  case class ReloadMatchAck(success: Boolean)

  case object GetActorStatus
  case class ActorStatus(
    matchManagers: Map[String, MatchManagerStatus],
    reservationHandlerReservations: Int,
    paymentGatewayPending: Int,
    totalSeatActors: Int,
    totalZoneManagers: Int,
    sessionManagerActive: Boolean,
    seatAllocatorActive: Boolean,
    reservationHandlerActive: Boolean,
    paymentGatewayActive: Boolean
  )
  case class MatchManagerStatus(
    matchId: String,
    zones: Map[String, ZoneStatus]
  )
  case class ZoneStatus(
    zone: String,
    totalSeats: Int,
    freeSeats: Int,
    reservedSeats: Int,
    confirmedSeats: Int,
    lockedSeats: Int,
    seatActorCount: Int
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

  private var matchManagers: Map[MatchId, ActorRef] = {
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
      paymentGateway  = paymentGateway,
      seatRefResolver = new ActorRefSeatRefResolver(() => matchManagers),
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

    case ReloadMatch(matchId) =>
      matchManagers.get(matchId) match {
        case Some(mm) =>
          mm ! MatchManager.ReloadZones
          log.info("Supervisor: ReloadZones envoyé au MatchManager {}", matchId)
          sender() ! ReloadMatchAck(true)
        case None =>
          // Create a new MatchManager for this match
          val mm = context.actorOf(MatchManager.props(matchId, db), s"match-manager-$matchId")
          matchManagers = matchManagers.updated(matchId, mm)
          log.info("Supervisor: nouveau MatchManager créé pour {}", matchId)
          sender() ! ReloadMatchAck(true)
      }

    case GetActorStatus =>
      implicit val timeout: Timeout = Timeout(5.seconds)
      implicit val ec: ExecutionContext = context.dispatcher
      val replyTo = sender()
      val mmFutures = matchManagers.map { case (matchId, mm) =>
        (mm ? MatchManager.GetZoneStatuses).mapTo[MatchManager.ZoneStatuses]
          .map(zs => matchId.toString -> MatchManagerStatus(matchId.toString, zs.zones))
          .recover {
            case e: Exception =>
              log.error(s"Failed to get status for MatchManager $matchId: ${e.getMessage}")
              matchId.toString -> MatchManagerStatus(matchId.toString, Map.empty)
          }
      }
      val rhFuture = (reservationHandler ? ReservationHandler.GetActiveReservationCount).mapTo[Int].recover { case _ => 0 }
      val pgFuture = (paymentGateway ? PaymentGateway.GetPendingPaymentCount).mapTo[Int].recover { case _ => 0 }
      val statusFuture = for {
        mmStatus <- Future.sequence(mmFutures).map(_.toMap)
        resCount <- rhFuture
        pgCount  <- pgFuture
      } yield {
        val totalZones = mmStatus.values.map(_.zones.size).sum
        val totalSeats = mmStatus.values.flatMap(_.zones.values.map(_.seatActorCount)).sum
        ActorStatus(
          matchManagers = mmStatus,
          reservationHandlerReservations = resCount,
          paymentGatewayPending = pgCount,
          totalSeatActors = totalSeats,
          totalZoneManagers = totalZones,
          sessionManagerActive = true,
          seatAllocatorActive = true,
          reservationHandlerActive = true,
          paymentGatewayActive = true
        )
      }
      statusFuture.recover {
        case e: Exception =>
          log.error(s"Global status aggregation failed: ${e.getMessage}")
          ActorStatus(Map.empty, 0, 0, 0, 0, false, false, false, false)
      }.pipeTo(replyTo)
  }
}

private class ActorRefSeatRefResolver(matchManagersRef: () => Map[MatchId, ActorRef])
    extends ReservationHandler.SeatRefResolver {

  import akka.pattern.ask
  import akka.util.Timeout
  import scala.concurrent.Await
  import scala.concurrent.duration._
  import scala.util.Try

  implicit val timeout: Timeout = Timeout(5.seconds)

  override def resolve(matchId: MatchId, zone: Zone, seatIds: Set[SeatId]): Map[SeatId, ActorRef] =
    matchManagersRef().get(matchId) match {
      case None => Map.empty
      case Some(mm) =>
        Try(Await.result(
          (mm ? MatchManager.GetSeatRefs(matchId, zone, seatIds)).mapTo[MatchManager.SeatRefsResult],
          6.seconds
        )).map(_.refs).getOrElse(Map.empty)
    }

  override def resolveAll(matchId: MatchId, seatIds: Set[SeatId]): (Map[SeatId, ActorRef], Map[SeatId, Zone]) =
    matchManagersRef().get(matchId) match {
      case None => (Map.empty, Map.empty)
      case Some(mm) =>
        Try(Await.result(
          (mm ? MatchManager.GetAllSeatRefs(matchId, seatIds)).mapTo[MatchManager.AllSeatRefsResult],
          6.seconds
        )).map(r => (r.refs, r.zones)).getOrElse((Map.empty, Map.empty))
    }
}
