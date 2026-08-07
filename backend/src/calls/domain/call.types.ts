export type CallKind = 'VOICE' | 'VIDEO';

export type CallSignal = {
  callId: string;
  conversationId: string;
  kind: CallKind;
  callerId: string;
  recipientId: string;
  callerName: string;
  callerAvatarUrl: string | null;
  occurredAt: string;
};
