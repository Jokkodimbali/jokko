import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, TrackSource, type VideoGrant } from 'livekit-server-sdk';
import type { MediaRoomProviderPort } from '../application/ports/media-room-provider.port';
import type { CallKind } from '../domain/call.types';

@Injectable()
export class LiveKitMediaRoomAdapter implements MediaRoomProviderPort {
  constructor(private readonly config: ConfigService) {}

  async createJoinCredential(input: {
    roomName: string;
    userId: string;
    displayName: string;
    kind: CallKind;
  }) {
    const serverUrl = this.config.get<string>('LIVEKIT_URL');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Le service d appel nest pas configure.',
      );
    }
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: input.userId,
      name: input.displayName,
      ttl: '10m',
    });
    const grant: VideoGrant = {
      room: input.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources:
        input.kind === 'VIDEO'
          ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
          : [TrackSource.MICROPHONE],
    };
    accessToken.addGrant(grant);
    return { serverUrl, token: await accessToken.toJwt() };
  }
}
