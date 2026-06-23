import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { CloudinaryMediaService } from '../../../shared/media/cloudinary-media.service';
import { DisputesFacade } from '../../application/services/disputes-facade.service';

type UploadedDisputeEvidenceFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const allowedDisputeEvidenceMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@ApiTags('Litiges')
@ApiBearerAuth()
@Controller('reservations/:reservationId/dispute')
@UseGuards(JwtAuthGuard)
export class UserDisputeEvidenceController {
  constructor(
    private readonly disputesFacade: DisputesFacade,
    private readonly cloudinaryMedia: CloudinaryMediaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Recuperer le suivi du litige d une reservation' })
  @ApiParam({
    name: 'reservationId',
    description: 'Identifiant de reservation',
  })
  async getDisputeForReservation(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    const result = await this.disputesFacade.getByReservationForUser(
      user,
      reservationId,
    );
    return createApiResponse(result, appMessage('DISPUTES_RETRIEVED').message);
  }

  @Post('evidence')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('evidence', 4, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedDisputeEvidenceMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader les preuves associees a un litige' })
  @ApiParam({
    name: 'reservationId',
    description: 'Identifiant de reservation',
  })
  async uploadEvidence(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @UploadedFiles() files: UploadedDisputeEvidenceFile[] | undefined,
  ) {
    if (!files || files.length === 0) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        this.cloudinaryMedia
          .upload({
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            folder: 'jokko/dispute-evidence',
          })
          .catch(() => {
            throw appHttpException('VALIDATION_REQUEST_INVALID');
          }),
      ),
    );

    const result = await this.disputesFacade.addEvidenceForReservation(
      user,
      reservationId,
      files.map((file, index) => ({
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: uploadedFiles[index]?.bytes ?? file.size,
        fileUrl: uploadedFiles[index]?.secureUrl ?? '',
      })),
    );

    return createApiResponse(
      result.evidence,
      appMessage('DISPUTES_EVIDENCE_UPLOADED').message,
    );
  }
}
