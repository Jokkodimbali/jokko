import { describe, expect, it } from 'vitest';
import { reservationServiceNameFromNotes } from './reservation-service-name';

describe('delivery service reason', () => {
  it.each([
    ['Type de livraison: Medicaments. Expediteur: Pharmacie', 'Livraison de médicament'],
    ['Type de livraison: Médicaments. Expediteur: Pharmacie', 'Livraison de médicament'],
    ['Type de livraison: Materiel de prestation. Expediteur: Boutique', 'Livraison de matériel'],
    ['Type de livraison: Matériel. Expediteur: Boutique', 'Livraison de matériel'],
    ['Type de livraison: Colis. Expediteur: Boutique', null],
    ['Une note concernant Medicaments', null],
    [null, null],
    ['Motif reserve: Livraison urgente. Reservation creee', 'Livraison urgente'],
  ])('resolves %s', (notes, expected) => {
    expect(reservationServiceNameFromNotes(notes)).toBe(expected);
  });
});
