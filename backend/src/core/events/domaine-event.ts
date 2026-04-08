export interface DomaineEvent<TPayload = unknown> {
  nom: string;
  dateOccurrence: Date;
  payload: TPayload;
}
