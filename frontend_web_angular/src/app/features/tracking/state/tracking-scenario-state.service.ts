import { Injectable } from '@angular/core';
import { AppointmentView } from '../../appointments/domain/appointments.models';

export type TrackingScenario = 'client-travels' | 'provider-travels' | 'parcel-delivery';

@Injectable()
export class TrackingScenarioStateService {
  scenarioFor(appointment: AppointmentView | null | undefined): TrackingScenario {
    if (appointment?.travelMode === 'TRANSPORT_COLIS') return 'parcel-delivery';
    if (appointment?.travelMode === 'CLIENT_SE_DEPLACE') return 'client-travels';
    return 'provider-travels';
  }

  routeActorIsClient(appointment: AppointmentView | null | undefined): boolean {
    return this.scenarioFor(appointment) === 'client-travels';
  }

  routeActorIsProvider(appointment: AppointmentView | null | undefined): boolean {
    return !this.routeActorIsClient(appointment);
  }

  shouldUseCurrentGpsOnly(appointment: AppointmentView | null | undefined): boolean {
    return this.scenarioFor(appointment) === 'client-travels';
  }
}
