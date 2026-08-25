import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import type { UserNotificationView } from '../../../../../core/notifications/notifications.service';
import { MessagesRealtimeService } from '../../../../messages/data-access/messages-realtime.service';
import { PharmacyOrdersService } from '../../../data-access/pharmacy-orders.service';
import { PharmacyOrdersInboxPageComponent } from './pharmacy-orders-inbox-page.component';

describe('PharmacyOrdersInboxPageComponent', () => {
  let notificationCreated: Subject<UserNotificationView>;
  const ordersService = { list: vi.fn(() => of([])) };
  const realtime = {
    connect: vi.fn(),
    notificationCreated$: new Subject<UserNotificationView>().asObservable(),
  };

  beforeEach(async () => {
    notificationCreated = new Subject<UserNotificationView>();
    realtime.notificationCreated$ = notificationCreated.asObservable();
    ordersService.list.mockClear();
    realtime.connect.mockClear();
    await TestBed.configureTestingModule({
      imports: [PharmacyOrdersInboxPageComponent],
      providers: [
        { provide: PharmacyOrdersService, useValue: ordersService },
        {
          provide: AuthSessionService,
          useValue: { currentUser: () => ({ id: 'pharmacy-user' }) },
        },
        { provide: MessagesRealtimeService, useValue: realtime },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    })
      .overrideComponent(PharmacyOrdersInboxPageComponent, { set: { template: '' } })
      .compileComponents();
  });

  async function flushAsyncWork(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('refreshes silently when a pharmacy order notification arrives', async () => {
    const fixture = TestBed.createComponent(PharmacyOrdersInboxPageComponent);
    fixture.detectChanges();
    await flushAsyncWork();

    expect(realtime.connect).toHaveBeenCalledOnce();
    expect(ordersService.list).toHaveBeenCalledTimes(1);

    notificationCreated.next({
      id: 'notification-1',
      type: 'ORDONNANCE_RECUE',
      data: { pharmacyOrderId: 'order-1' },
    });
    await flushAsyncWork();

    expect(ordersService.list).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('ignores realtime notifications unrelated to pharmacy orders', async () => {
    const fixture = TestBed.createComponent(PharmacyOrdersInboxPageComponent);
    fixture.detectChanges();
    await flushAsyncWork();

    notificationCreated.next({ id: 'notification-2', type: 'MESSAGE_RECU', data: {} });
    await flushAsyncWork();

    expect(ordersService.list).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
