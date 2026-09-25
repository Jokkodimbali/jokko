import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CloudinaryMediaService } from './cloudinary-media.service';
import { TeleconsultationDocumentService } from './teleconsultation-document.service';

@Module({
  imports: [PrismaModule],
  providers: [CloudinaryMediaService, TeleconsultationDocumentService],
  exports: [CloudinaryMediaService, TeleconsultationDocumentService],
})
export class MediaModule {}
