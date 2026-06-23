import { Module } from '@nestjs/common';
import { CloudinaryMediaService } from './cloudinary-media.service';

@Module({
  providers: [CloudinaryMediaService],
  exports: [CloudinaryMediaService],
})
export class MediaModule {}
