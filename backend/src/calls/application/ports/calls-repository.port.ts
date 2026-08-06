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
  durationSeconds: number | null;
};
export type CallView = {
  id: string;
  conversationId: string;
  kind: CallKind;
  status: CallStatus;
  callerId: string;
  recipientId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  recipientName: string;
  recipientAvatarUrl: string | null;
  startedAt: Date;
};

export interface CallsRepositoryPort {
  isUserActive(userId: string): Promise<boolean>;
  create(input: {
    id: string;
    conversationId: string;
    callerId: string;
    recipientId: string;
    kind: CallKind;
    expiresAt: Date;
  }): Promise<'CREATED' | 'IDEMPOTENT' | 'BUSY'>;
  transition(input: {
    id: string;
    actorId: string;
    from: CallStatus[];
    to: CallStatus;
  }): Promise<boolean>;
  findForParticipant(id: string, userId: string): Promise<CallView | null>;
  findActiveForUser(userId: string): Promise<CallView | null>;
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
