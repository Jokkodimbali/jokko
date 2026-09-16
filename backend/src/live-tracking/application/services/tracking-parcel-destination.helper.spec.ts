import type { ReservationTrackingContext } from '../ports/live-tracking-repository.port';
import { resolveTrackingDestinationAddress } from './tracking-parcel-destination.helper';

describe('resolveTrackingDestinationAddress', () => {
  it.each([
    ['colis', 'Type de livraison: Colis. Depart colis: Expéditeur Parcelles. Arrivee destinataire: Destinataire Plateau.'],
    ['médicaments', 'Type de livraison: Medicaments. Expediteur: Pharmacie Jokko. Depart colis: Pharmacie Mermoz. Arrivee destinataire: Client Ouakam.'],
    ['matériel', 'Type de livraison: Materiel de prestation. Expediteur: Quincaillerie Jokko. Depart colis: Quincaillerie Liberté. Arrivee destinataire: Client Almadies.'],
  ])('uses the pickup then the drop-off for a %s delivery', (_kind, reservationNotes) => {
    const beforePickup = context(reservationNotes, 'PAYEE_SEQUESTRE');
    const afterPickup = context(reservationNotes, 'EN_COURS');

    expect(resolveTrackingDestinationAddress(beforePickup)).toMatch(/(?:Expéditeur|Pharmacie|Quincaillerie)/);
    expect(resolveTrackingDestinationAddress(afterPickup)).toMatch(/(?:Destinataire|Client)/);
    expect(resolveTrackingDestinationAddress(afterPickup)).not.toBe(
      resolveTrackingDestinationAddress(beforePickup),
    );
  });
});

function context(
  reservationNotes: string,
  reservationStatus: 'PAYEE_SEQUESTRE' | 'EN_COURS',
): ReservationTrackingContext {
  return {
    reservationId: 'reservation',
    clientUserId: 'client',
    professionalId: 'professional',
    professionalUserId: 'professional-user',
    reservationStatus,
    reservationNotes,
    travelMode: 'TRANSPORT_COLIS',
    adresseClient: 'Adresse client de secours',
  } as ReservationTrackingContext;
}
