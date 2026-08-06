export type CallKind = 'VOICE' | 'VIDEO';
export type CallPhase = 'OUTGOING' | 'INCOMING' | 'CONNECTING' | 'ACTIVE';

export interface CallSignal {
  callId: string;
  conversationId: string;
  kind: CallKind;
  callerId: string;
  recipientId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  occurredAt: string;
}

export interface ActiveCall extends CallSignal {
  phase: CallPhase;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
}

export interface CallHistoryItem {
  id: string;
  conversationId: string;
  kind: CallKind;
  status: 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED' | 'MISSED' | 'FAILED';
  callerId: string;
  recipientId: string;
  direction: 'INCOMING' | 'OUTGOING';
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  startedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
}
