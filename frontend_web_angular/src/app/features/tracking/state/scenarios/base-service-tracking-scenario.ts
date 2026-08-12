import {
  AppointmentTravelMode,
  AppointmentView,
} from '../../../appointments/domain/appointments.models';
import {
  TrackingRouteActor,
  TrackingScenarioStep,
  TrackingScenarioStrategy,
  TrackingScenarioViewContext,
} from './tracking-scenario.types';

export abstract class BaseServiceTrackingScenario implements TrackingScenarioStrategy {
  abstract readonly id: TrackingScenarioStrategy['id'];
  abstract readonly travelMode: AppointmentTravelMode | null;
  abstract readonly routeActor: TrackingRouteActor;

  isParcelDelivery(): boolean {
    return false;
  }

  isClientTraveler(): boolean {
    return this.routeActor === 'client';
  }

  isProviderTraveler(): boolean {
    return this.routeActor === 'provider';
  }

  shouldUseCurrentGpsOnly(): boolean {
    return this.isClientTraveler();
  }

  trackedTravelerName(appointment: AppointmentView | null | undefined): string {
    if (!appointment) return 'Le participant';
    return this.isClientTraveler()
      ? appointment.clientName || 'Le client'
      : appointment.doctorName || 'Le prestataire';
  }

  trackedTravelerRoleLabel(): 'client' | 'prestataire' {
    return this.isClientTraveler() ? 'client' : 'prestataire';
  }

  clientTimelineSteps(context: TrackingScenarioViewContext): TrackingScenarioStep[] {
    return [
      {
        label: 'Confirme',
        description: 'Reservation validee',
        icon: 'calendar-days',
      },
      {
        label: 'En route',
        description: `${context.travelerName} se deplace`,
        icon: 'send',
      },
      {
        label: this.workStepLabel(),
        description: this.workStepDescription(),
        icon: this.workStepIcon(),
      },
      {
        label: 'Termine',
        description: 'Mission cloturee',
        icon: 'check',
      },
    ];
  }

  providerTimelineSteps(_context: TrackingScenarioViewContext): TrackingScenarioStep[] {
    return [
      { label: 'A venir', description: 'Mission planifiee', icon: 'briefcase-business' },
      { label: 'Trajet', description: 'Navigation active', icon: 'send' },
      {
        label: this.workStepLabel(),
        description: this.workStepDescription(),
        icon: this.workStepIcon(),
      },
      { label: 'Cloture', description: 'Mission terminee', icon: 'check' },
    ];
  }

  clientTrackingTitle(context: TrackingScenarioViewContext): string {
    if (context.appointmentCompleted) return 'Termine';
    if (context.providerWorking) return this.workInProgressTitle();
    if (context.travelerArrived) return this.arrivedTitle();
    if (context.providerOnTheWay) return this.onTheWayTitle();
    return this.idleClientTitle();
  }

  clientTrackingDescription(context: TrackingScenarioViewContext): string {
    if (context.appointmentCompleted) {
      return this.completedClientDescription();
    }
    if (context.providerWorking) {
      return this.workingClientDescription(context);
    }
    if (context.travelerArrived) {
      return this.arrivedClientDescription(context);
    }
    if (context.providerOnTheWay) {
      return this.onTheWayClientDescription(context);
    }
    return this.idleClientDescription();
  }

  providerOnTheWayActionLabel(context: TrackingScenarioViewContext): string {
    if (this.isClientTraveler()) {
      return context.travelerArrived ? 'Commencer la prestation' : 'Client en deplacement';
    }
    return 'Je suis arrive sur place';
  }

  providerWaitingActionLabel(): string {
    return this.isClientTraveler() ? 'En attente du client' : 'Trajet indisponible';
  }

  vehicleArrivedLabel(context: TrackingScenarioViewContext): string {
    return `${context.travelerName} est sur place`;
  }

  protected abstract workStepLabel(): string;
  protected abstract workStepDescription(): string;
  protected abstract workStepIcon(): string;
  protected abstract workInProgressTitle(): string;
  protected abstract idleClientTitle(): string;
  protected abstract idleClientDescription(): string;
  protected abstract completedClientDescription(): string;
  protected abstract providerNameLabel(context: TrackingScenarioViewContext): string;

  protected arrivedTitle(): string {
    return this.isClientTraveler() ? 'Vous etes sur place' : 'Prestataire sur place';
  }

  protected onTheWayTitle(): string {
    return this.isClientTraveler() ? 'Vous etes en deplacement' : 'En route vers vous';
  }

  protected arrivedClientDescription(context: TrackingScenarioViewContext): string {
    return this.isClientTraveler()
      ? `Vous etes sur place. ${this.providerNameLabel(context)} peut commencer la prestation.`
      : `${this.providerNameLabel(context)} est sur place. La prestation peut commencer.`;
  }

  protected workingClientDescription(context: TrackingScenarioViewContext): string {
    return `L'intervention est en cours. Le ${context.providerRole} intervient actuellement.`;
  }

  protected onTheWayClientDescription(context: TrackingScenarioViewContext): string {
    return this.isClientTraveler()
      ? `Vous etes en deplacement. ${this.providerNameLabel(context)} attend votre arrivee a destination.`
      : `${this.providerNameLabel(context)} est en deplacement. Il utilise l'itineraire le plus rapide pour arriver a l'heure.`;
  }

  providerIdleEyebrow(): string {
    return this.isClientTraveler() ? 'Arrivee client attendue' : 'Arrivee client souhaitee';
  }

  providerIdleDescription(): string {
    return this.isClientTraveler()
      ? 'En attente du client. Il doit partager sa position pour que vous puissiez voir son deplacement sur la carte et commencer la prestation.'
      : 'Activez le trajet le jour du rendez-vous pour partager votre position au client.';
  }
}
