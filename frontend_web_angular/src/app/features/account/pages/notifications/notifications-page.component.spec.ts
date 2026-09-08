import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPageComponent } from './notifications-page.component';
import { NotificationsService, UserNotificationView } from '../../../../core/notifications/notifications.service';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { MessagesRealtimeService } from '../../../messages/data-access/messages-realtime.service';

describe('notification page live updates', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('cancels stale requests, refreshes on socket events and cleans up on destruction', () => {
    vi.useFakeTimers();
    const events = new Subject<UserNotificationView>();
    const responses: Subject<UserNotificationView[]>[] = [];
    const list = vi.fn(() => { const response = new Subject<UserNotificationView[]>(); responses.push(response); return response; });
    TestBed.configureTestingModule({ providers: [
      { provide: NotificationsService, useValue: { list } },
      { provide: MessagesRealtimeService, useValue: { connect: vi.fn(), notificationCreated$: events } },
      { provide: AuthSessionService, useValue: {} },
      { provide: AppFeedbackService, useValue: {} },
      { provide: AppointmentsService, useValue: {} },
      { provide: Router, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new NotificationsPageComponent());
    const view = component as unknown as { notifications: () => UserNotificationView[] };
    component.ngOnInit();
    vi.advanceTimersByTime(0);
    const latest = { id: 'latest', type: 'APPEL_MANQUE' };
    events.next(latest);
    responses[1].next([latest]);
    responses[0].next([{ id: 'stale', type: 'NOUVEAU_MESSAGE' }]);
    expect(view.notifications()).toEqual([latest]);
    vi.advanceTimersByTime(15_000);
    expect(list).toHaveBeenCalledTimes(3);
    TestBed.resetTestingModule();
    events.next(latest);
    vi.advanceTimersByTime(15_000);
    expect(list).toHaveBeenCalledTimes(3);
  });
});
