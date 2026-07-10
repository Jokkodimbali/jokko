import { AppointmentTravelMode, AppointmentView } from '../../../appointments/domain/appointments.models';
import { AppointmentTrackingStep } from '../../../appointments/presentation/components/appointment-tracking-stepper/appointment-tracking-stepper.component';

export type TrackingScenarioId =
  | 'doctor-to-client'
  | 'client-to-doctor'
  | 'provider-to-client'
  | 'client-to-provider'
  | 'parcel-delivery';

export type TrackingRouteActor = 'client' | 'provider';

export type TrackingScenarioStep = Omit<AppointmentTrackingStep, 'state'>;

export type TrackingScenarioLabels = {
  clientFirstName: string;
  providerFirstName: string;
  providerRole: string;
  travelerName: string;
};

export type TrackingScenarioStatus = {
  appointmentCompleted: boolean;
  providerWorking: boolean;
  providerOnTheWay: boolean;
  travelerArrived: boolean;
  parcelPickupValidated: boolean;
  parcelDropoffValidated: boolean;
  parcelDropoffNavigationActive: boolean;
  parcelAwaitingPickupScan: boolean;
  parcelAwaitingDropoffScan: boolean;
  routeEtaLabel: string;
};

export type TrackingScenarioViewContext = TrackingScenarioLabels & TrackingScenarioStatus;

export interface TrackingScenarioStrategy {
  readonly id: TrackingScenarioId;
  readonly travelMode: AppointmentTravelMode | null;
  readonly routeActor: TrackingRouteActor;

  isParcelDelivery(): boolean;
  isClientTraveler(): boolean;
  isProviderTraveler(): boolean;
  shouldUseCurrentGpsOnly(): boolean;
  trackedTravelerName(appointment: AppointmentView | null | undefined): string;
  trackedTravelerRoleLabel(): 'client' | 'prestataire';
  clientTrackingTitle(context: TrackingScenarioViewContext): string;
  clientTrackingDescription(context: TrackingScenarioViewContext): string;
  clientTimelineSteps(context: TrackingScenarioViewContext): TrackingScenarioStep[];
  providerTimelineSteps(context: TrackingScenarioViewContext): TrackingScenarioStep[];
  providerIdleEyebrow(): string;
  providerIdleDescription(): string;
  providerWaitingActionLabel(): string;
  providerOnTheWayActionLabel(context: TrackingScenarioViewContext): string;
  vehicleArrivedLabel(context: TrackingScenarioViewContext): string;
}
