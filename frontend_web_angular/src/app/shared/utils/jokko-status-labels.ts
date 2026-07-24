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

export function reservationStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'CONFIRMEE':
      return 'Confirme';
    case 'PAYEE_SEQUESTRE':
    case 'EN_COURS':
      return 'En cours';
    case 'TERMINEE':
      return 'Terminee';
    case 'ANNULEE':
      return 'Annulee';
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
    case 'TERMINEE':
      return 'green';
    case 'ANNULEE':
    case 'NO_SHOW':
    case 'LITIGE':
      return 'red';
    default:
      return 'neutral';
  }
}

export function negotiationStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'ACCEPTEE':
      return 'Acceptee';
    case 'CONVERTIE_EN_RESERVATION':
      return 'Confirme';
    case 'REFUSEE':
      return 'Refusee';
    case 'ANNULEE':
      return 'Annulee';
    case 'EN_ATTENTE_PRESTATAIRE':
    case 'EN_ATTENTE_CLIENT':
    default:
      return 'En negociation';
  }
}

export function isNegotiationInProgressStatus(status: string | null | undefined): boolean {
  return (
    status !== 'ACCEPTEE' &&
    status !== 'CONVERTIE_EN_RESERVATION' &&
    status !== 'REFUSEE' &&
    status !== 'ANNULEE'
  );
}
