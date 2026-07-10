import { Injectable, signal } from '@angular/core';

export type TrackingArrivalPoint = {
  lat: number;
  lng: number;
};

@Injectable()
export class TrackingArrivalStateService {
  private readonly arrivedReservationId = signal<string | null>(null);
  private readonly arrivalPoint = signal<TrackingArrivalPoint | null>(null);

  readonly version = signal(0);

  markArrived(reservationId: string, point: TrackingArrivalPoint | null): void {
    this.arrivedReservationId.set(reservationId);
    this.arrivalPoint.set(point);
    this.version.update((value) => value + 1);
  }

  clear(reservationId?: string): void {
    if (reservationId && this.arrivedReservationId() !== reservationId) return;
    this.arrivedReservationId.set(null);
    this.arrivalPoint.set(null);
    this.version.update((value) => value + 1);
  }

  isArrived(reservationId: string | null | undefined): boolean {
    return !!reservationId && this.arrivedReservationId() === reservationId;
  }

  pointFor(reservationId: string | null | undefined): TrackingArrivalPoint | null {
    return this.isArrived(reservationId) ? this.arrivalPoint() : null;
  }
}
