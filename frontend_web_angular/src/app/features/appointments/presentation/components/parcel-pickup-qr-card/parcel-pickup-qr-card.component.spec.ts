import { describe, expect, it, vi } from 'vitest';
import QRCode from 'qrcode';
import { ParcelPickupQrCardComponent } from './parcel-pickup-qr-card.component';
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') } }));

describe('shared parcel QR checkpoints', () => {
  it.each([['RETRAIT', 'expediteur'], ['DEPOT', 'destinataire']] as const)('generates the %s checkpoint for the correct participant', async (checkpoint, participant) => {
    const card = new ParcelPickupQrCardComponent();
    card.reservationId = 'reservation'; card.serviceId = 'service'; card.checkpoint = checkpoint;
    card.ngOnChanges();
    await vi.waitFor(() => expect(card['imageUrl']()).toBeTruthy());
    const url = new URL(vi.mocked(QRCode.toDataURL).mock.calls.at(-1)![0] as string);
    expect(url.pathname).toBe('/appointments/reservation/qr/' + participant);
    expect(url.searchParams.get('c')).toBe(checkpoint);
    expect(url.searchParams.get('r')).toBe('reservation');
  });
});

it('hides the used pickup QR while keeping the delivery QR available until completion', () => {
  const card = new ParcelPickupQrCardComponent();
  card.reservationStatus = 'EN_COURS';
  expect(card['isAvailable']).toBe(false);
  card.checkpoint = 'DEPOT';
  expect(card['isAvailable']).toBe(true);
  card.reservationStatus = 'TERMINEE';
  expect(card['isAvailable']).toBe(false);
});
