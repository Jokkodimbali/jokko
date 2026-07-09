import type { ReservationTrackingContext } from '../ports/live-tracking-repository.port';

const NOTE_KEYS = [
  'Type de livraison',
  'Expediteur',
  'Depart colis',
  'Destinataire',
  'Arrivee destinataire',
  'Distance estimee',
  'Tarif kilometrique',
  'Prix calcule',
  'Note livraison',
];

export function resolveTrackingDestinationAddress(
  context: ReservationTrackingContext,
): string {
  if (context.travelMode === 'CLIENT_SE_DEPLACE') {
    return context.adresseDestinationPrestataire;
  }

  if (context.travelMode !== 'TRANSPORT_COLIS') {
    return context.adresseClient;
  }

  const pickupAddress = extractAppointmentNoteValue(
    context.reservationNotes,
    'Depart colis',
  );
  const dropoffAddress = extractAppointmentNoteValue(
    context.reservationNotes,
    'Arrivee destinataire',
  );

  return context.reservationStatus === 'EN_COURS' ||
    context.reservationStatus === 'TERMINEE'
    ? dropoffAddress || context.adresseClient
    : pickupAddress || context.adresseClient;
}

function extractAppointmentNoteValue(
  notes: string | null,
  key: string,
): string | null {
  if (!notes) return null;

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const otherKeys = NOTE_KEYS.filter((item) => item !== key)
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(
    `${escapedKey}\\s*[:=-]\\s*(.*?)(?=\\.\\s+(?:${otherKeys}|Colis\\s+\\d+)\\s*[:(]|$)`,
    'i',
  );
  const match = notes.match(pattern);

  return match?.[1]?.trim().replace(/\.$/, '').trim() || null;
}
