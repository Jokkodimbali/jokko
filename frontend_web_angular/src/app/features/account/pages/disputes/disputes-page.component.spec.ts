import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisputesPageComponent } from './disputes-page.component';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../core/navigation/back-navigation.service';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';

describe('dispute notification selection', () => {
  afterEach(() => TestBed.resetTestingModule());

  it.each([
    ['resolved-reservation', 'resolved-reservation'],
    ['missing-reservation', null],
    [null, 'open-reservation'],
  ])('selects the requested reservation %s without opening an unrelated dispute', (requestedId, expectedId) => {
    const getReservationDispute = vi.fn(() => of(null));
    TestBed.configureTestingModule({ providers: [
      { provide: AuthSessionService, useValue: { currentUser: () => ({ role: 'CLIENT' }) } },
      { provide: AppointmentsService, useValue: {
        listMyAppointments: () => of([
          { id: 'open-reservation', status: 'LITIGE' },
          { id: 'resolved-reservation', status: 'TERMINEE' },
        ]), getReservationDispute,
      } },
      { provide: ActivatedRoute, useValue: { snapshot: {
        queryParamMap: convertToParamMap(requestedId ? { reservationId: requestedId } : {}),
      } } },
      { provide: Router, useValue: {} },
      { provide: BackNavigationService, useValue: {} },
      { provide: AppFeedbackService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new DisputesPageComponent());
    component.ngOnInit();
    if (expectedId) expect(getReservationDispute).toHaveBeenCalledExactlyOnceWith(expectedId);
    else expect(getReservationDispute).not.toHaveBeenCalled();
  });
});
