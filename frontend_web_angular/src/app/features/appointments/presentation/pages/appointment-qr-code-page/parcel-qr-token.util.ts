export type ParcelQrCheckpoint = 'RETRAIT' | 'DEPOT';

export function parcelQrReference(reservationId: string, serviceId: string): string {
  const hash = parcelQrChecksum(`${reservationId}|${serviceId}|1|${reservationId}`);
  return String(1000 + (hash % 9000));
}

export function buildParcelQrUrl(input: {
  reservationId: string;
  serviceId: string;
  checkpoint: ParcelQrCheckpoint;
  origin: string;
}): string {
  const reference = parcelQrReference(input.reservationId, input.serviceId);
  const signature = parcelQrChecksum(
    ['JOKKO_PARCEL_CHECKPOINT', input.reservationId, input.serviceId, reference].join('|'),
  )
    .toString(36)
    .toUpperCase();
  const url = new URL(
    `/appointments/${input.reservationId}/qr/${input.checkpoint === 'RETRAIT' ? 'expediteur' : 'destinataire'}`,
    input.origin,
  );
  url.searchParams.set('r', input.reservationId);
  url.searchParams.set('c', input.checkpoint);
  url.searchParams.set('ref', reference);
  url.searchParams.set('sig', signature);
  return url.toString();
}

export function parcelQrChecksum(value: string): number {
  return value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 99991, 17);
}
