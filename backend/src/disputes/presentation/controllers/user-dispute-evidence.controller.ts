import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
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
import {
  diskStorage,
  type DiskStorageCallback,
  type DiskStorageFile,
} from 'multer';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import { buildPublicUploadUrl } from '../../../shared/http/public-upload-url';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { DisputesFacade } from '../../application/services/disputes-facade.service';

type UploadedDisputeEvidenceFile = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

const disputeEvidenceUploadDirectory = join(
  process.cwd(),
  'uploads',
  'dispute-evidence',
);

const allowedDisputeEvidenceMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function ensureDisputeEvidenceUploadDirectory(): void {
  mkdirSync(disputeEvidenceUploadDirectory, { recursive: true });
}

function buildDisputeEvidenceFileName(originalName: string): string {
  const extension = extname(originalName).toLowerCase() || '.bin';
  const safeExtension = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(
    extension,
  )
    ? extension
    : '.bin';
  return `dispute-evidence-${Date.now()}-${randomUUID()}${safeExtension}`;
}

@ApiTags('Litiges')
@ApiBearerAuth()
@Controller('reservations/:reservationId/dispute')
@UseGuards(JwtAuthGuard)
export class UserDisputeEvidenceController {
  constructor(private readonly disputesFacade: DisputesFacade) {}

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
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          ensureDisputeEvidenceUploadDirectory();
          callback(null, disputeEvidenceUploadDirectory);
        },
        filename: (
          _request: unknown,
          file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          callback(null, buildDisputeEvidenceFileName(file.originalname));
        },
      }),
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
    @Req() request: Request,
  ) {
    if (!files || files.length === 0) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const result = await this.disputesFacade.addEvidenceForReservation(
      user,
      reservationId,
      files.map((file) => ({
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileUrl: buildPublicUploadUrl(
          request,
          `/uploads/dispute-evidence/${file.filename}`,
        ),
      })),
    );

    return createApiResponse(
      result.evidence,
      appMessage('DISPUTES_EVIDENCE_UPLOADED').message,
    );
  }
}
