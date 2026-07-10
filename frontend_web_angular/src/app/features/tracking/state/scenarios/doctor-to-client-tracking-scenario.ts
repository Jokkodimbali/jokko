import { AppointmentTravelMode } from '../../../appointments/domain/appointments.models';
import { BaseServiceTrackingScenario } from './base-service-tracking-scenario';
import { TrackingScenarioViewContext } from './tracking-scenario.types';

export class DoctorToClientTrackingScenario extends BaseServiceTrackingScenario {
  readonly id = 'doctor-to-client' as const;
  readonly travelMode: AppointmentTravelMode = 'PRESTATAIRE_SE_DEPLACE';
  readonly routeActor = 'provider' as const;

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
    return 'Consultation confirmee';
  }

  protected idleClientDescription(): string {
    return "Votre medecin se prepare. L'heure de rendez-vous a ete bloquee dans son agenda.";
  }

  protected completedClientDescription(): string {
    return "La consultation s'est deroulee avec succes.";
  }

  protected providerNameLabel(context: TrackingScenarioViewContext): string {
    return context.providerFirstName;
  }
}
