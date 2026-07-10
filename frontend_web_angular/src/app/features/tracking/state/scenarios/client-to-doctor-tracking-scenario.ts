import { AppointmentTravelMode } from '../../../appointments/domain/appointments.models';
import { BaseServiceTrackingScenario } from './base-service-tracking-scenario';
import { TrackingScenarioViewContext } from './tracking-scenario.types';

export class ClientToDoctorTrackingScenario extends BaseServiceTrackingScenario {
  readonly id = 'client-to-doctor' as const;
  readonly travelMode: AppointmentTravelMode = 'CLIENT_SE_DEPLACE';
  readonly routeActor = 'client' as const;

  protected workStepLabel(): string {
    return 'Consultation';
  }

  protected workStepDescription(): string {
    return 'Soins en cours';
  }

  protected workStepIcon(): string {
    return 'stethoscope';
  }

  protected workInProgressTitle(): string {
    return 'Consultation en cours';
  }

  protected idleClientTitle(): string {
    return 'Partager votre position';
  }

  protected idleClientDescription(): string {
    return 'Vous devez partager votre position pour que le medecin puisse voir votre deplacement et preparer la consultation a votre arrivee.';
  }

  protected completedClientDescription(): string {
    return "La consultation s'est deroulee avec succes.";
  }

  protected providerNameLabel(context: TrackingScenarioViewContext): string {
    return context.providerFirstName;
  }
}
