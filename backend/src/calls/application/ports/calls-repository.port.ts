import type { CallKind } from '../../domain/call.types';

export const CALLS_REPOSITORY_PORT = Symbol('CALLS_REPOSITORY_PORT');
export type CallStatus =
  | 'RINGING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ENDED'
  | 'MISSED'
  | 'FAILED';
export type CallHistoryView = {
  id: string;
  conversationId: string;
  kind: CallKind;
  status: CallStatus;
  callerId: string;
  recipientId: string;
  counterpartName: string;
  direction: 'INCOMING' | 'OUTGOING';
  counterpartAvatarUrl: string | null;
  startedAt: Date;
  acceptedAt: Date | null;
  endedAt: Date | null;
};

export interface CallsRepositoryPort {
  create(input: {
    id: string;
    conversationId: string;
    callerId: string;
    recipientId: string;
    kind: CallKind;
    expiresAt: Date;
  }): Promise<void>;
  transition(input: {
    id: string;
    actorId: string;
    from: CallStatus[];
    to: CallStatus;
  }): Promise<boolean>;
  listForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<CallHistoryView[]>;
  expireRinging(now: Date): Promise<
    Array<{
      id: string;
      conversationId: string;
      callerId: string;
      recipientId: string;
      kind: CallKind;
    }>
  >;
}
