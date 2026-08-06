import {
  AppointmentTravelMode,
  AppointmentView,
} from '../../../appointments/domain/appointments.models';
import { BaseServiceTrackingScenario } from './base-service-tracking-scenario';
import { TrackingScenarioStep, TrackingScenarioViewContext } from './tracking-scenario.types';

export class ParcelDeliveryTrackingScenario extends BaseServiceTrackingScenario {
  readonly id = 'parcel-delivery' as const;
  readonly travelMode: AppointmentTravelMode = 'TRANSPORT_COLIS';
  readonly routeActor = 'provider' as const;

  override isParcelDelivery(): boolean {
    return true;
  }

  override trackedTravelerName(appointment: AppointmentView | null | undefined): string {
    return appointment?.doctorName || 'Le livreur';
  }

  override clientTrackingTitle(context: TrackingScenarioViewContext): string {
    if (context.appointmentCompleted) return 'Transport de colis termine';
    if (context.parcelAwaitingDropoffScan) return 'Livreur arrive chez le destinataire';
    if (context.travelerArrived) return 'Livreur sur place';
    if (context.parcelDropoffNavigationActive) return 'Livreur en route vers le destinataire';
    if (context.parcelPickupValidated) return 'Colis pris en charge';
    if (context.parcelAwaitingPickupScan) return "Livreur arrive chez l'expediteur";
    if (context.providerOnTheWay) return "Livreur en route vers l'expediteur";
    return 'Transport de colis';
  }

  override clientTrackingDescription(context: TrackingScenarioViewContext): string {
    if (context.appointmentCompleted) {
      return 'Votre colis a ete livre avec succes au destinataire.';
    }
    if (context.parcelAwaitingDropoffScan) {
      return 'Le livreur est sur place chez le destinataire. Le QR depot doit etre scanne pour valider la livraison.';
    }
    if (context.travelerArrived) {
      return 'Le livreur est sur place. La prochaine validation peut etre effectuee.';
    }
    if (context.parcelDropoffNavigationActive) {
      return 'Le livreur transporte le colis vers le destinataire. Le QR depot sera demande a son arrivee.';
    }
    if (context.parcelPickupValidated) {
      return 'Le retrait est confirme. Le livreur peut maintenant rejoindre le destinataire.';
    }
    if (context.parcelAwaitingPickupScan) {
      return "Le livreur est sur place chez l'expediteur. Le QR retrait doit etre scanne pour confirmer la prise en charge.";
    }
    if (context.providerOnTheWay) {
      return "Le livreur rejoint l'expediteur. Preparez le QR retrait pour confirmer la prise en charge.";
    }
    return "Votre colis est pris en charge. Telechargez les QR codes a remettre a l'expediteur et au destinataire.";
  }

  override clientTimelineSteps(context: TrackingScenarioViewContext): TrackingScenarioStep[] {
    return this.parcelSteps(false, context);
  }

  override providerTimelineSteps(context: TrackingScenarioViewContext): TrackingScenarioStep[] {
    return this.parcelSteps(true, context);
  }

  override providerIdleEyebrow(): string {
    return 'Arrivee client souhaitee';
  }

  override providerIdleDescription(): string {
    return 'Demarrez la livraison pour partager votre position et rejoindre le point de retrait.';
  }

  override providerOnTheWayActionLabel(): string {
    return 'Sur place';
  }

  override vehicleArrivedLabel(context: TrackingScenarioViewContext): string {
    return context.parcelPickupValidated
      ? 'Le livreur est arrive sur place chez le destinataire'
      : "Le livreur est arrive sur place chez l'expediteur";
  }

  protected workStepLabel(): string {
    return 'QR retrait';
  }

  protected workStepDescription(): string {
    return 'Colis pris en charge';
  }

  protected workStepIcon(): string {
    return 'maximize-2';
  }

  protected workInProgressTitle(): string {
    return 'Livraison en cours';
  }

  protected idleClientTitle(): string {
    return 'Transport de colis';
  }

  protected idleClientDescription(): string {
    return "Votre colis est pris en charge. Telechargez les QR codes a remettre a l'expediteur et au destinataire.";
  }

  protected completedClientDescription(): string {
    return 'Votre colis a ete livre avec succes au destinataire.';
  }

  protected providerNameLabel(): string {
    return 'Le livreur';
  }

  private parcelSteps(
    providerMode: boolean,
    context: TrackingScenarioViewContext,
  ): TrackingScenarioStep[] {
    return [
      {
        label: 'Planifie',
        description: providerMode ? 'Livraison confirmee' : 'Le transport du colis est programme',
        icon: 'calendar-days',
      },
      {
        label: 'Vers expediteur',
        description: providerMode
          ? "Rejoignez l'expediteur pour recuperer le colis"
          : "Le livreur est en route vers l'expediteur",
        icon: 'send',
      },
      {
        label: 'QR retrait',
        description: context.parcelPickupValidated
          ? 'Retrait valide, colis pris en charge'
          : "Scan chez l'expediteur attendu",
        icon: 'maximize-2',
      },
      {
        label: 'Vers destinataire',
        description: providerMode
          ? 'Livrez le colis au destinataire'
          : 'Le livreur transporte le colis au destinataire',
        icon: 'map-pin',
      },
      {
        label: context.appointmentCompleted ? 'Livre' : 'QR depot',
        description:
          context.parcelDropoffValidated || context.appointmentCompleted
            ? 'Livraison validee chez le destinataire'
            : 'Scan chez le destinataire attendu',
        icon: 'check',
      },
    ];
  }
}
