import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TendersController } from './tenders.controller';
import { TendersService } from './tenders.service';
import { TenderMatchingService } from './tender-matching.service';
import { TenderNotificationsService } from './tender-notifications.service';
@Module({
  imports: [AuthModule, PrismaModule, SearchModule, NotificationsModule],
  controllers: [TendersController],
  providers: [
    TendersService,
    TenderMatchingService,
    TenderNotificationsService,
  ],
})
export class TendersModule {}
