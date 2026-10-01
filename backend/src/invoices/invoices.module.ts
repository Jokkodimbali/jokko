import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../shared/media/media.module';
import { InvoiceTemplateService } from './invoice-template.service';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';

@Module({
  imports: [AuthModule, PrismaModule, MediaModule],
  controllers: [InvoicesController],
  providers: [InvoiceTemplateService, InvoicesService],
})
export class InvoicesModule {}
