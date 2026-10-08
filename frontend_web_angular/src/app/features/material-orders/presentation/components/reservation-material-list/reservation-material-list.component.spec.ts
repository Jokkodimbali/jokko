import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { ReservationMaterialListComponent } from './reservation-material-list.component';
import { ServiceProposalService } from '../../../../services/data-access/service-proposal.service';
import { MessagesRealtimeService } from '../../../../messages/data-access/messages-realtime.service';
import { formatNotificationTitle } from '../../../../../core/notifications/notifications.service';

function setup() {
  const events = new Subject<any>();
  const api = {
    listReservationMaterialQuotes: vi.fn().mockReturnValue(of([])),
    createReservationMaterialList: vi
      .fn()
      .mockReturnValue(of([{ id: 'item', designation: 'PVC', quantity: 2 }])),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ServiceProposalService, useValue: api },
      { provide: MessagesRealtimeService, useValue: { notificationCreated$: events } },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new ReservationMaterialListComponent());
  component.reservationId = 'reservation';
  component.status = 'PAYEE_SEQUESTRE';
  return { component, api, events };
}
afterEach(() => TestBed.resetTestingModule());
it('lets the provider send material after payment', () => {
  const { component, api } = setup();
  component.isProvider = true;
  (component as any).rows = [{ designation: 'PVC', quantity: 2 }];
  (component as any).save();
  expect(api.createReservationMaterialList).toHaveBeenCalledWith('reservation', [
    { designation: 'PVC', quantity: 2, unitPrice: 0 },
  ]);
  expect((component as any).items()).toHaveLength(1);
});
it('does not submit for clients or closed reservations', () => {
  const { component, api } = setup();
  (component as any).save();
  component.isProvider = true;
  component.status = 'ANNULEE';
  (component as any).save();
  expect(api.createReservationMaterialList).not.toHaveBeenCalled();
});
it('refreshes the list when this reservation receives a material notification', () => {
  const { api, events } = setup();
  events.next({ data: { reservationId: 'other', materialList: true } });
  expect(api.listReservationMaterialQuotes).not.toHaveBeenCalled();
  events.next({ data: { reservationId: 'reservation', materialList: true } });
  expect(api.listReservationMaterialQuotes).toHaveBeenCalledWith('reservation');
});
it('preserves the material notification title instead of displaying a price adjustment', () => {
  expect(
    formatNotificationTitle({
      id: 'notification',
      type: 'AJUSTEMENT_PRIX_PROPOSE',
      title: 'Matériel à acheter pour votre réservation',
      data: { materialList: true },
    }),
  ).toBe('Matériel à acheter pour votre réservation');
});
