import {
  Body,
  Controller,
  Delete,
  UploadedFile,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { DiskStorageCallback, DiskStorageFile } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { appMessage } from '../../../core/http/app-http.exception';
import { appHttpException } from '../../../core/http/app-http.exception';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { UsersService } from '../../application/services/users.service';
import { UsersMedicalProfileService } from '../../application/services/users-medical-profile.service';
import { UpdateMyProfileDto } from '../dto/update-my-profile.dto';
import { UpdateMyAvatarDto } from '../dto/update-my-avatar.dto';
import { ChangeMyPasswordDto } from '../dto/change-my-password.dto';
import { UpdateMyMedicalProfileDto } from '../dto/update-my-medical-profile.dto';
import { UpsertMyMedicalTreatmentDto } from '../dto/upsert-my-medical-treatment.dto';
import { UploadMyProfessionalCredentialDto } from '../dto/upload-my-professional-credential.dto';
import { UpsertMyProfessionalExpertiseDto } from '../dto/upsert-my-professional-expertise.dto';
import { UpdateMyProfessionalAboutDto } from '../dto/update-my-professional-about.dto';
import { MyHistoryQueryDto } from '../dto/my-history-query.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

type UploadedAvatarFile = {
  filename: string;
  mimetype: string;
  size: number;
};

type UploadedProfessionalCredentialFile = UploadedAvatarFile & {
  originalname: string;
};

const avatarUploadDirectory = join(process.cwd(), 'uploads', 'avatars');
const professionalCredentialUploadDirectory = join(
  process.cwd(),
  'uploads',
  'medical-credentials',
);
const allowedAvatarMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const allowedProfessionalCredentialMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function ensureAvatarUploadDirectory(): void {
  mkdirSync(avatarUploadDirectory, { recursive: true });
}

function ensureProfessionalCredentialUploadDirectory(): void {
  mkdirSync(professionalCredentialUploadDirectory, { recursive: true });
}

function buildAvatarFileName(userId: string, originalName: string): string {
  const extension = extname(originalName).toLowerCase() || '.jpg';
  const safeExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension)
    ? extension
    : '.jpg';
  return `${userId}-${Date.now()}${safeExtension}`;
}

function buildProfessionalCredentialFileName(originalName: string): string {
  const extension = extname(originalName).toLowerCase() || '.bin';
  const safeExtension = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.pdf',
    '.doc',
    '.docx',
  ].includes(extension)
    ? extension
    : '.bin';
  return `medical-credential-${Date.now()}-${randomUUID()}${safeExtension}`;
}

@ApiTags(API_DOCS.users.tag)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersMedicalProfileService: UsersMedicalProfileService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.meSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.common.profileRetrieved,
    messageExample: API_DOCS.common.profileRetrieved,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.users.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.usersService.me(user.sub);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.updateSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('USERS_PROFILE_UPDATED').message,
    messageExample: appMessage('USERS_PROFILE_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.users.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.users.updateBadRequest,
    errorCode: 'USERS_UPDATE_EMPTY',
    messageExample: API_DOCS.users.updateBadRequest,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.users.updateConflict,
    errorCode: 'USERS_EMAIL_ALREADY_USED',
    messageExample: API_DOCS.users.updateConflict,
  })
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    const result = await this.usersService.updateMe(user.sub, dto);
    return createApiResponse(
      result,
      appMessage('USERS_PROFILE_UPDATED').message,
    );
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Modifier mon mot de passe' })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('USERS_PASSWORD_UPDATED').message,
    messageExample: appMessage('USERS_PASSWORD_UPDATED').message,
    dataSchema: {
      type: 'null',
      example: null,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_INVALID_CREDENTIALS',
    messageExample: appMessage('AUTH_INVALID_CREDENTIALS').message,
  })
  async changeMyPassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangeMyPasswordDto,
  ) {
    await this.usersService.changeMyPassword(user.sub, dto);
    return createApiResponse(
      null,
      appMessage('USERS_PASSWORD_UPDATED').message,
    );
  }

  @Get('me/medical-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Consulter ma fiche medicale' })
  async myMedicalProfile(@CurrentUser() user: AuthUser) {
    const result = await this.usersMedicalProfileService.getMyMedicalProfile(
      user.sub,
    );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_PROFILE_RETRIEVED').message,
    );
  }

  @Get('patients/:clientId/medical-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Consulter la fiche medicale d un patient suivi' })
  async patientMedicalProfile(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
  ) {
    const result =
      await this.usersMedicalProfileService.getPatientMedicalProfileForProfessional(
        user,
        clientId,
      );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_PROFILE_RETRIEVED').message,
    );
  }

  @Put('me/medical-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Creer ou modifier ma fiche medicale' })
  async updateMyMedicalProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyMedicalProfileDto,
  ) {
    const result = await this.usersMedicalProfileService.updateMyMedicalProfile(
      user.sub,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_PROFILE_UPDATED').message,
    );
  }

  @Post('me/medical-profile/treatments')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter un traitement medical' })
  async createMyMedicalTreatment(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertMyMedicalTreatmentDto,
  ) {
    const result = await this.usersMedicalProfileService.createTreatment(
      user.sub,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_TREATMENT_CREATED').message,
    );
  }

  @Patch('me/medical-profile/treatments/:treatmentId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Modifier un traitement medical' })
  async updateMyMedicalTreatment(
    @CurrentUser() user: AuthUser,
    @Param('treatmentId') treatmentId: string,
    @Body() dto: UpsertMyMedicalTreatmentDto,
  ) {
    const result = await this.usersMedicalProfileService.updateTreatment(
      user.sub,
      treatmentId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_TREATMENT_UPDATED').message,
    );
  }

  @Delete('me/medical-profile/treatments/:treatmentId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un traitement medical' })
  async deleteMyMedicalTreatment(
    @CurrentUser() user: AuthUser,
    @Param('treatmentId') treatmentId: string,
  ) {
    const result = await this.usersMedicalProfileService.deleteTreatment(
      user.sub,
      treatmentId,
    );
    return createApiResponse(
      result,
      appMessage('USERS_MEDICAL_TREATMENT_DELETED').message,
    );
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.users.avatarSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('USERS_AVATAR_UPDATED').message,
    messageExample: appMessage('USERS_AVATAR_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.users.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.users.avatarBadRequest,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.users.avatarBadRequest,
  })
  async updateMyAvatar(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyAvatarDto,
  ) {
    const result = await this.usersService.updateMyAvatar(user.sub, dto);
    return createApiResponse(
      result,
      appMessage('USERS_AVATAR_UPDATED').message,
    );
  }

  @Post('me/avatar/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          ensureAvatarUploadDirectory();
          callback(null, avatarUploadDirectory);
        },
        filename: (
          request: unknown,
          file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          const authUser = (request as Request & { user?: AuthUser }).user;
          callback(
            null,
            buildAvatarFileName(authUser?.sub ?? 'user', file.originalname),
          );
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!allowedAvatarMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader ma photo de profil' })
  async uploadMyAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedAvatarFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const origin = `${request.protocol}://${request.get('host')}`;
    const avatarUrl = `${origin}/uploads/avatars/${file.filename}`;
    const result = await this.usersService.updateMyAvatar(user.sub, {
      avatarUrl,
    });
    return createApiResponse(
      result,
      appMessage('USERS_AVATAR_UPDATED').message,
    );
  }

  @Post('me/professional-credentials/upload')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('document', {
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          ensureProfessionalCredentialUploadDirectory();
          callback(null, professionalCredentialUploadDirectory);
        },
        filename: (
          _request: unknown,
          file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          callback(null, buildProfessionalCredentialFileName(file.originalname));
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!allowedProfessionalCredentialMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un diplome ou certificat professionnel' })
  async uploadMyProfessionalCredential(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadMyProfessionalCredentialDto,
    @UploadedFile() file: UploadedProfessionalCredentialFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const origin = `${request.protocol}://${request.get('host')}`;
    const documentUrl = `${origin}/uploads/medical-credentials/${file.filename}`;
    const result = await this.usersService.uploadMyProfessionalCredential(user, {
      title: dto.title?.trim() || file.originalname,
      institution: dto.institution?.trim() || 'Document fourni par le professionnel',
      graduationYear: dto.graduationYear?.trim() || null,
      referenceNumber: dto.referenceNumber?.trim() || null,
      documentUrl,
    });

    return createApiResponse(
      result,
      appMessage('USERS_PROFESSIONAL_CREDENTIAL_UPLOADED').message,
    );
  }

  @Delete('me/professional-credentials/:credentialId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un diplome ou certificat professionnel' })
  async deleteMyProfessionalCredential(
    @CurrentUser() user: AuthUser,
    @Param('credentialId') credentialId: string,
  ) {
    const result = await this.usersService.deleteMyProfessionalCredential(
      user,
      credentialId,
    );
    return createApiResponse(
      result,
      appMessage('USERS_PROFESSIONAL_CREDENTIAL_DELETED').message,
    );
  }

  @Patch('me/professional-about')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Modifier ma presentation professionnelle' })
  async updateMyProfessionalAbout(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfessionalAboutDto,
  ) {
    const result = await this.usersService.updateMyProfessionalAbout(user, dto);
    return createApiResponse(
      result,
      appMessage('USERS_PROFESSIONAL_ABOUT_UPDATED').message,
    );
  }

  @Post('me/professional-expertises')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ajouter une expertise professionnelle' })
  async addMyProfessionalExpertise(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertMyProfessionalExpertiseDto,
  ) {
    const result = await this.usersService.addMyProfessionalExpertise(user, dto);
    return createApiResponse(
      result,
      appMessage('USERS_PROFESSIONAL_EXPERTISE_ADDED').message,
    );
  }

  @Delete('me/professional-expertises')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirer une expertise professionnelle' })
  async removeMyProfessionalExpertise(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertMyProfessionalExpertiseDto,
  ) {
    const result = await this.usersService.removeMyProfessionalExpertise(
      user,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('USERS_PROFESSIONAL_EXPERTISE_REMOVED').message,
    );
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.historySummary })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.users.historyLimitDescription,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.users.historySuccess,
    messageExample: API_DOCS.users.historySuccess,
    dataSchema: {
      type: 'array',
      items: {
        type: 'object',
      },
      example: SWAGGER_RESPONSE_EXAMPLES.users.historyData,
    },
  })
  async myHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: MyHistoryQueryDto,
  ) {
    const result = await this.usersService.getMyHistory(user.sub, query);
    return createApiResponse(result);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.users.deleteSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    messageExample: appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    dataSchema: {
      type: 'null',
      example: null,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.usersService.anonymizeMe(user.sub);
    return createApiResponse(
      null,
      appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    );
  }
}
