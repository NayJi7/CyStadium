package cystadium.actors

import akka.actor.ActorSystem
import akka.testkit.{ImplicitSender, TestKit}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.wordspec.AnyWordSpecLike
import cystadium.protocol._
import java.time.Instant
import java.util.UUID

class SeatActorSpec extends TestKit(ActorSystem("CyStadiumTest"))
  with ImplicitSender
  with AnyWordSpecLike
  with BeforeAndAfterAll {

  override def afterAll(): Unit = {
    TestKit.shutdownActorSystem(system)
  }

  "Un SeatActor" should {

    "réserver un siège libre avec succès" in {
      // 1. Préparation des fausses données
      val matchId = UUID.randomUUID()
      val seatId = UUID.randomUUID()
      
      // On crée ton acteur avec un statut initial 'Free'
      val seatActor = system.actorOf(SeatActor.props(matchId, seatId, VIP, 500.0, Free))

      val clientId = UUID.randomUUID()
      val bookingId = UUID.randomUUID()
      val deadline = Instant.now().plusSeconds(600) // +10 minutes

      // 2. Action : on lui envoie le message de réservation
      seatActor ! ReserveSeat(clientId, bookingId, deadline)

      // 3. Vérification : on s'attend à recevoir la confirmation
      expectMsg(SeatReservedOk(seatId))
    }

    "refuser la réservation si le siège est déjà réservé" in {
      val matchId = UUID.randomUUID()
      val seatId = UUID.randomUUID()
      
      // On simule un siège qui est DÉJÀ réservé (lu depuis la DB par exemple)
      val existingBooking = UUID.randomUUID()
      val initialState = Reserved(UUID.randomUUID(), existingBooking, Instant.now().plusSeconds(300))
      
      val seatActor = system.actorOf(SeatActor.props(matchId, seatId, Standard, 100.0, initialState))

      // Un autre client essaie de réserver
      val newClientId = UUID.randomUUID()
      val newBookingId = UUID.randomUUID()
      
      seatActor ! ReserveSeat(newClientId, newBookingId, Instant.now().plusSeconds(600))

      // Il doit recevoir une erreur avec le statut actuel
      expectMsg(SeatUnavailable(seatId, initialState))
    }
  }
}
