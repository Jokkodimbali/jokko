import type { DomaineEvent } from './domaine-event';
export declare const DOMAINE_EVENT_BUS: unique symbol;
export interface DomaineEventBusPort {
    publier(event: DomaineEvent): Promise<void>;
}
