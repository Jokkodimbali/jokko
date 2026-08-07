import type { CallKind } from '../../domain/call.types';

export const MEDIA_ROOM_PROVIDER_PORT = Symbol('MEDIA_ROOM_PROVIDER_PORT');

export interface MediaRoomProviderPort {
  createJoinCredential(input: {
    roomName: string;
    userId: string;
    displayName: string;
    kind: CallKind;
  }): Promise<{ serverUrl: string; token: string }>;
}
