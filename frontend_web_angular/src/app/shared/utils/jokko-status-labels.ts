export type JokkoReservationStatus =
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export type JokkoNegotiationStatus =
  | 'EN_ATTENTE_PRESTATAIRE'
  | 'EN_ATTENTE_CLIENT'
  | 'ACCEPTEE'
  | 'REFUSEE'
  | 'ANNULEE'
  | 'CONVERTIE_EN_RESERVATION';

export type JokkoStatusTone = 'blue' | 'green' | 'red' | 'neutral';
export type JokkoStatusIcon = 'circle-check' | 'handshake' | 'more-horizontal' | 'scale' | null;

export function reservationStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'CONFIRMEE':
      return 'Confirmé';
    case 'PAYEE_SEQUESTRE':
    case 'EN_COURS':
      return 'En cours';
    case 'TERMINEE':
      return 'Terminé';
    case 'ANNULEE':
      return 'Annulée';
    case 'NO_SHOW':
      return 'Absent';
    case 'LITIGE':
      return 'Litige';
    default:
      return 'Reservation';
  }
}

export function reservationStatusTone(status: string | null | undefined): JokkoStatusTone {
  switch (status) {
    case 'PAYEE_SEQUESTRE':
    case 'EN_COURS':
      return 'blue';
    case 'CONFIRMEE':
      return 'green';
    case 'TERMINEE':
      return 'neutral';
    case 'ANNULEE':
    case 'NO_SHOW':
    case 'LITIGE':
      return 'red';
    default:
      return 'neutral';
  }
}

export function reservationStatusIcon(status: string | null | undefined): JokkoStatusIcon {
  switch (status) {
    case 'CONFIRMEE':
      return 'circle-check';
    case 'PAYEE_SEQUESTRE':
    case 'EN_COURS':
      return 'more-horizontal';
    case 'LITIGE':
      return 'scale';
    default:
      return null;
  }
}

export function negotiationStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'ACCEPTEE':
      return 'Acceptée';
    case 'CONVERTIE_EN_RESERVATION':
      return 'Confirmé';
    case 'ANNULEE':
    case 'REFUSEE':
      return 'Annulée';
    case 'EN_ATTENTE_PRESTATAIRE':
    case 'EN_ATTENTE_CLIENT':
    default:
      return 'En négociation';
  }
}

export function negotiationStatusIcon(status: string | null | undefined): JokkoStatusIcon {
  if (status === 'EN_ATTENTE_PRESTATAIRE' || status === 'EN_ATTENTE_CLIENT') return 'handshake';
  if (status === 'ACCEPTEE' || status === 'CONVERTIE_EN_RESERVATION') return 'circle-check';
  return null;
}

export function isNegotiationInProgressStatus(status: string | null | undefined): boolean {
  return (
    status !== 'ACCEPTEE' &&
    status !== 'CONVERTIE_EN_RESERVATION' &&
    status !== 'REFUSEE' &&
    status !== 'ANNULEE'
  );
}
