import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { MEDIA_ROOM_PROVIDER_PORT } from './application/ports/media-room-provider.port';
import { CallsService } from './application/services/calls.service';
import { LiveKitMediaRoomAdapter } from './infrastructure/livekit-media-room.adapter';
import { CallsController } from './presentation/calls.controller';
import { CallsGateway } from './presentation/calls.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { CALLS_REPOSITORY_PORT } from './application/ports/calls-repository.port';
import { CallsRepository } from './infrastructure/calls.repository';

@Module({
  imports: [AuthModule, JwtModule, MessagingModule, NotificationsModule],
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsRepository,
    { provide: CALLS_REPOSITORY_PORT, useExisting: CallsRepository },
    LiveKitMediaRoomAdapter,
    { provide: MEDIA_ROOM_PROVIDER_PORT, useExisting: LiveKitMediaRoomAdapter },
    CallsGateway,
  ],
})
export class CallsModule {}
