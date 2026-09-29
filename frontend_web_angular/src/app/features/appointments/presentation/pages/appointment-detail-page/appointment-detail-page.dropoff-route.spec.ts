import { AppointmentDetailPageComponent } from './appointment-detail-page.component';

describe('post-scan shared delivery route', () => {
  it.each(['colis', 'médicaments', 'matériel'])(
    'keeps the %s route until the new session and drop-off stage are ready',
    () => {
      const component = Object.create(AppointmentDetailPageComponent.prototype) as Record<string, any>;
      const selection = {
        reservationId: 'reservation-1',
        sessionStartedAt: '2026-09-28T10:05:00.000Z',
        routeId: 'route-0',
        coordinates: [{ lat: 14.7, lng: -17.4 }, { lat: 14.8, lng: -17.3 }],
      };
      let sessionStartedAt = '2026-09-28T10:00:00.000Z';
      let dropoffActive = false;
      const install = vi.fn();
      component['pendingRouteSelection'] = selection;
      component['tracking'] = () => ({ startedAt: sessionStartedAt });
      component['appointment'] = () => ({ travelMode: 'TRANSPORT_COLIS' });
      component['isParcelTransportAppointment'] = () => true;
      component['isParcelDropoffNavigationActive'] = () => dropoffActive;
      component['installSharedRouteSelection'] = install;

      component['applyPendingRouteSelection']();
      expect(install).not.toHaveBeenCalled();
      sessionStartedAt = selection.sessionStartedAt;
      component['applyPendingRouteSelection']();
      expect(install).not.toHaveBeenCalled();

      dropoffActive = true;
      component['applyPendingRouteSelection']();
      expect(install).toHaveBeenCalledExactlyOnceWith(selection);
      expect(component['pendingRouteSelection']).toBeNull();
    },
  );
});
