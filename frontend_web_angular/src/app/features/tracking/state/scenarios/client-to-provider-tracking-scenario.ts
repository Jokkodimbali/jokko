import { AppointmentTravelMode } from '../../../appointments/domain/appointments.models';
import { BaseServiceTrackingScenario } from './base-service-tracking-scenario';
import { TrackingScenarioViewContext } from './tracking-scenario.types';

export class ClientToProviderTrackingScenario extends BaseServiceTrackingScenario {
  readonly id = 'client-to-provider' as const;
  readonly travelMode: AppointmentTravelMode = 'CLIENT_SE_DEPLACE';
  readonly routeActor = 'client' as const;

  protected workStepLabel(): string {
    return 'Intervention';
  }

  protected workStepDescription(): string {
    return 'Travaux en cours';
  }

  protected workStepIcon(): string {
    return 'wrench';
  }

  protected workInProgressTitle(): string {
    return 'Travaux en cours';
  }

  protected idleClientTitle(): string {
    return 'Partager votre position';
  }

  protected idleClientDescription(): string {
    return "Vous devez partager votre position pour que le prestataire puisse voir votre deplacement et preparer l'intervention a votre arrivee.";
  }

  protected completedClientDescription(): string {
    return "L'intervention s'est deroulee avec succes. Tout est desormais parfaitement fonctionnel.";
  }

  protected providerNameLabel(context: TrackingScenarioViewContext): string {
    return context.providerFirstName;
  }
}
