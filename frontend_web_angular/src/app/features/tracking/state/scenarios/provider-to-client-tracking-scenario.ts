import { AppointmentTravelMode } from '../../../appointments/domain/appointments.models';
import { BaseServiceTrackingScenario } from './base-service-tracking-scenario';
import { TrackingScenarioViewContext } from './tracking-scenario.types';

export class ProviderToClientTrackingScenario extends BaseServiceTrackingScenario {
  readonly id = 'provider-to-client' as const;
  readonly travelMode: AppointmentTravelMode = 'PRESTATAIRE_SE_DEPLACE';
  readonly routeActor = 'provider' as const;

  protected workStepLabel(): string {
    return 'Intervention';
  }

  protected workStepDescription(): string {
    return 'Travaux en cours';
  }

  protected workStepIcon(): string {
    return 'clock-3';
  }

  protected workInProgressTitle(): string {
    return 'Travaux en cours';
  }

  protected idleClientTitle(): string {
    return 'Intervention confirmee';
  }

  protected idleClientDescription(): string {
    return "Votre professionnel se prepare. L'heure de rendez-vous a ete bloquee dans son agenda.";
  }

  protected completedClientDescription(): string {
    return "L'intervention s'est deroulee avec succes. Tout est desormais parfaitement fonctionnel.";
  }

  protected providerNameLabel(context: TrackingScenarioViewContext): string {
    return context.providerFirstName;
  }
}
