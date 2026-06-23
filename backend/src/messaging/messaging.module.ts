import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { CloudinaryMediaService } from '../shared/media/cloudinary-media.service';
import { UsersModule } from '../users/users.module';
import { MESSAGING_REPOSITORY_PORT } from './application/ports/messaging-repository.port';
import { MessagingCommandService } from './application/services/messaging-command.service';
import { MessagingFacade } from './application/services/messaging-facade.service';
import { MessagingQueryService } from './application/services/messaging-query.service';
import { MessagingRepository } from './infrastructure/repositories/messaging.repository';
import { ConversationsController } from './presentation/controllers/conversations.controller';
import { MessagingGateway } from './presentation/gateways/messaging.gateway';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule,
    CoreModule,
    UsersModule,
    ProfessionalsModule,
    ReservationsModule,
    NotificationsModule,
  ],
  controllers: [ConversationsController],
  providers: [
    MessagingRepository,
    {
      provide: MESSAGING_REPOSITORY_PORT,
      useExisting: MessagingRepository,
    },
    MessagingCommandService,
    MessagingQueryService,
    MessagingFacade,
    MessagingGateway,
    CloudinaryMediaService,
  ],
  exports: [MessagingFacade],
})
export class MessagingModule {}
