package cystadium.actors

import akka.actor.{Actor, ActorLogging, Props}
import cystadium.protocol._

object SeatActor {
  // Le ZoneManager d'Eléonore utilisera cette méthode pour créer tes acteurs.
  // On passe matchId en paramètre car tu en as besoin pour le SeatStatusEvent.
  def props(matchId: MatchId, seatId: SeatId, zone: Zone, price: Double, initialState: SeatStatus): Props =
    Props(new SeatActor(matchId, seatId, zone, price, initialState))
}

class SeatActor(val matchId: MatchId, val seatId: SeatId, val zone: Zone, val price: Double, initialState: SeatStatus) 
  extends Actor with ActorLogging {

  // L'acteur démarre avec le statut lu en base de données, comme exigé par la spec.
  var status: SeatStatus = initialState

  // Fonction utilitaire pour centraliser la mise à jour de l'état et la publication de l'événement pour Adam.
  private def changeStatusAndPublish(newStatus: SeatStatus): Unit = {
    status = newStatus
    context.system.eventStream.publish(SeatStatusEvent(matchId, seatId, newStatus))
  }

  def receive: Receive = {
    
    // 1. Demande de réservation par le SeatAllocator (Fatima/Abdel)
    case ReserveSeat(clientId, bookingId, deadline) =>
      status match {
        case Free =>
          changeStatusAndPublish(Reserved(clientId, bookingId, deadline))
          sender() ! SeatReservedOk(seatId)
        case _ =>
          // Siège déjà réservé, confirmé ou bloqué
          sender() ! SeatUnavailable(seatId, status)
      }

    // 2. Confirmation suite à un paiement réussi
    case ConfirmSeat(bookingId) =>
      status match {
        case Reserved(cId, bId, _) if bId == bookingId =>
          changeStatusAndPublish(Confirmed(cId, bookingId))
          sender() ! SeatConfirmedOk(seatId)
        case _ =>
          // Ignoré silencieusement si le bookingId ne correspond pas ou si le siège n'est pas "Reserved"
          log.warning(s"[$seatId] Tentative de confirmation invalide pour le booking $bookingId")
      }

    // 3. Libération du siège (timeout ou échec du paiement)
    case ReleaseSeat(bookingId) =>
      status match {
        case Reserved(_, bId, _) if bId == bookingId =>
          changeStatusAndPublish(Free)
          sender() ! SeatReleasedOk(seatId)
        case _ =>
          // Ignoré silencieusement si le bookingId ne correspond pas
          log.warning(s"[$seatId] Tentative de libération invalide pour le booking $bookingId")
      }

    // 4. Demande d'état (utilisé par le ZoneManager pour CheckAvailability)
    case GetSeatStatus =>
      sender() ! SeatStatusResponse(seatId, status)
  }
}