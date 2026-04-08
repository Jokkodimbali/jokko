import type { DomaineEvent } from './domaine-event';

export const DOMAINE_EVENT_BUS = Symbol('DOMAINE_EVENT_BUS');

export interface DomaineEventBusPort {
  publier(event: DomaineEvent): Promise<void>;
}
