import { Injectable } from '@angular/core';
import { AppointmentView } from '../../appointments/domain/appointments.models';
import { ClientToDoctorTrackingScenario } from './scenarios/client-to-doctor-tracking-scenario';
import { ClientToProviderTrackingScenario } from './scenarios/client-to-provider-tracking-scenario';
import { DoctorToClientTrackingScenario } from './scenarios/doctor-to-client-tracking-scenario';
import { ParcelDeliveryTrackingScenario } from './scenarios/parcel-delivery-tracking-scenario';
import { ProviderToClientTrackingScenario } from './scenarios/provider-to-client-tracking-scenario';
import { TrackingScenarioStrategy } from './scenarios/tracking-scenario.types';

export type TrackingScenario = TrackingScenarioStrategy['id'];

@Injectable()
export class TrackingScenarioStateService {
  private readonly doctorToClient = new DoctorToClientTrackingScenario();
  private readonly clientToDoctor = new ClientToDoctorTrackingScenario();
  private readonly providerToClient = new ProviderToClientTrackingScenario();
  private readonly clientToProvider = new ClientToProviderTrackingScenario();
  private readonly parcelDelivery = new ParcelDeliveryTrackingScenario();

  scenarioFor(
    appointment: AppointmentView | null | undefined,
    isMedicalAppointment = false,
  ): TrackingScenarioStrategy {
    if (appointment?.travelMode === 'TRANSPORT_COLIS') return this.parcelDelivery;
    if (appointment?.travelMode === 'CLIENT_SE_DEPLACE') {
      return isMedicalAppointment ? this.clientToDoctor : this.clientToProvider;
    }
    return isMedicalAppointment ? this.doctorToClient : this.providerToClient;
  }

  scenarioIdFor(
    appointment: AppointmentView | null | undefined,
    isMedicalAppointment = false,
  ): TrackingScenario {
    return this.scenarioFor(appointment, isMedicalAppointment).id;
  }

  routeActorIsClient(
    appointment: AppointmentView | null | undefined,
    isMedicalAppointment = false,
  ): boolean {
    return this.scenarioFor(appointment, isMedicalAppointment).isClientTraveler();
  }

  routeActorIsProvider(
    appointment: AppointmentView | null | undefined,
    isMedicalAppointment = false,
  ): boolean {
    return this.scenarioFor(appointment, isMedicalAppointment).isProviderTraveler();
  }

  shouldUseCurrentGpsOnly(
    appointment: AppointmentView | null | undefined,
    isMedicalAppointment = false,
  ): boolean {
    return this.scenarioFor(appointment, isMedicalAppointment).shouldUseCurrentGpsOnly();
  }
}
