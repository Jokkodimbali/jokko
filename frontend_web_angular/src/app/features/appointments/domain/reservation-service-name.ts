/** Resolves the booked reason before falling back to the courier's catalogue service. */
export function reservationServiceNameFromNotes(notes: string | null | undefined): string | null {
  const requested = notes?.match(/(?:^|\s)Motif reserve:\s*(.+?)\.\s*(?:Reservation creee|$)/i);
  if (requested?.[1]?.trim()) return requested[1].trim().replace(/\s+/g, ' ');
  const normalized = (notes ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const type = normalized.match(/(?:^|\.\s*|\n)Type de livraison\s*:\s*([^.]*)/i)?.[1]?.trim();
  if (/^medicaments?$/i.test(type ?? '')) return 'Livraison de médicament';
  if (/^materiel(?: de prestation)?$/i.test(type ?? '')) return 'Livraison de matériel';
  return null;
}
