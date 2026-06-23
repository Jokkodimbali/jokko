import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfessionalsFacade } from '../../application/services/professionals-facade.service';
import { SearchQueryService } from '../../../search/application/services/search-query.service';
import { SearchProfessionalsQueryDto } from '../../../search/presentation/dto/search-professionals-query.dto';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import { CloudinaryMediaService } from '../../../shared/media/cloudinary-media.service';
import { CreateProfessionalProfileDto } from '../dto/create-professional-profile.dto';
import { SubmitKycDto } from '../dto/submit-kyc.dto';
import { UpdateProfessionalProfileDto } from '../dto/update-professional-profile.dto';
import { CreateProfessionalServiceDto } from '../dto/create-professional-service.dto';
import { UpdateProfessionalServiceDto } from '../dto/update-professional-service.dto';
import { CreatePortfolioItemDto } from '../dto/create-portfolio-item.dto';
import { CreateAvailabilityDto } from '../dto/create-availability.dto';
import {
  createApiResponse,
  createPaginatedResponse,
} from '../../../shared/dto/api-response.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

type UploadedProfessionalAssetFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const allowedProfessionalAssetMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@ApiTags(API_DOCS.professionals.tag)
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly professionalsFacade: ProfessionalsFacade,
    private readonly searchQueryService: SearchQueryService,
    private readonly cloudinaryMedia: CloudinaryMediaService,
  ) {}

  // ─── My Profile (Authenticated) ───────────────────────────────────────────

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createProfileSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_PROFILE_CREATED').message,
    messageExample: appMessage('PROFESSIONALS_PROFILE_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.professionals.createProfileForbidden,
    errorCode: 'PROFESSIONALS_FORBIDDEN_ROLE',
    messageExample: API_DOCS.professionals.createProfileForbidden,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.professionals.createProfileConflict,
    errorCode: 'PROFESSIONALS_PROFILE_ALREADY_EXISTS',
    messageExample: API_DOCS.professionals.createProfileConflict,
  })
  async createProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProfessionalProfileDto,
  ) {
    const result = await this.professionalsFacade.createProfile(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_PROFILE_CREATED').message,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.meSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.common.profileRetrieved,
    messageExample: API_DOCS.common.profileRetrieved,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
    },
  })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.me(user);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.updateSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_PROFILE_UPDATED').message,
    messageExample: appMessage('PROFESSIONALS_PROFILE_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
    },
  })
  async updateMyProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfessionalProfileDto,
  ) {
    const result = await this.professionalsFacade.updateMyProfile(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_PROFILE_UPDATED').message,
    );
  }

  // ─── KYC (Authenticated) ─────────────────────────────────────────────────

  @Patch('me/kyc/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.submitKycSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
    messageExample: appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
        statutKyc: 'EN_ATTENTE',
      },
    },
  })
  async submitKyc(@CurrentUser() user: AuthUser, @Body() dto: SubmitKycDto) {
    const result = await this.professionalsFacade.submitKyc(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
    );
  }

  // ─── Services (Authenticated) ─────────────────────────────────────────────

  @Post('me/services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createServiceSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_SERVICE_CREATED').message,
    messageExample: appMessage('PROFESSIONALS_SERVICE_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.serviceData,
    },
  })
  async createMyService(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProfessionalServiceDto,
  ) {
    const result = await this.professionalsFacade.createMyService(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_SERVICE_CREATED').message,
    );
  }

  @Get('me/services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.listServicesSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listServicesSuccess,
    messageExample: API_DOCS.professionals.listServicesSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.professionals.serviceData],
    },
  })
  async listMyServices(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.listMyServices(user);
    return createApiResponse(result);
  }

  @Patch('me/services/:serviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.updateServiceSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_SERVICE_UPDATED').message,
    messageExample: appMessage('PROFESSIONALS_SERVICE_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.serviceData,
    },
  })
  async updateMyService(
    @CurrentUser() user: AuthUser,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateProfessionalServiceDto,
  ) {
    const result = await this.professionalsFacade.updateMyService(
      user,
      serviceId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_SERVICE_UPDATED').message,
    );
  }

  @Delete('me/services/:serviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.disableServiceSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_SERVICE_DISABLED').message,
    messageExample: appMessage('PROFESSIONALS_SERVICE_DISABLED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.professionals.serviceData,
        estDisponible: false,
      },
    },
  })
  async disableMyService(
    @CurrentUser() user: AuthUser,
    @Param('serviceId') serviceId: string,
  ) {
    const result = await this.professionalsFacade.disableMyService(
      user,
      serviceId,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_SERVICE_DISABLED').message,
    );
  }

  // ─── Portfolio (Authenticated) ────────────────────────────────────────────

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createPortfolioSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_CREATED').message,
    messageExample: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.portfolioData,
    },
  })
  async createMyPortfolioItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    const result = await this.professionalsFacade.createMyPortfolioItem(
      user,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_PORTFOLIO_ITEM_CREATED').message,
    );
  }

  @Delete('me/portfolio/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.deletePortfolioSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_DELETED').message,
    messageExample: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_DELETED').message,
    dataSchema: {
      type: 'null',
      example: null,
    },
  })
  async deleteMyPortfolioItem(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
  ) {
    await this.professionalsFacade.deleteMyPortfolioItem(user, itemId);
    return createApiResponse(
      null,
      appMessage('PROFESSIONALS_PORTFOLIO_ITEM_DELETED').message,
    );
  }

  // ─── Availabilities (Authenticated) ───────────────────────────────────────

  @Post('me/uploads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedProfessionalAssetMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Uploader un fichier professionnel pour KYC ou portfolio',
  })
  async uploadMyProfessionalAsset(
    @UploadedFile() file: UploadedProfessionalAssetFile | undefined,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const uploaded = await this.cloudinaryMedia
      .upload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: 'jokko/professionals',
      })
      .catch(() => {
        throw appHttpException('VALIDATION_REQUEST_INVALID');
      });
    const fileUrl = uploaded.secureUrl;
    return createApiResponse(
      {
        fileUrl,
        imageUrl: fileUrl,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      'Fichier professionnel uploade avec succes.',
    );
  }

  @Post('me/availabilities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createAvailabilitySummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_AVAILABILITY_CREATED').message,
    messageExample: appMessage('PROFESSIONALS_AVAILABILITY_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.availabilityData,
    },
  })
  async createMyAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAvailabilityDto,
  ) {
    const result = await this.professionalsFacade.createMyAvailability(
      user,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_AVAILABILITY_CREATED').message,
    );
  }

  @Get('me/availabilities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.listAvailabilitiesSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listAvailabilitiesSuccess,
    messageExample: API_DOCS.professionals.listAvailabilitiesSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.professionals.availabilityData],
    },
  })
  async listMyAvailabilities(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.listMyAvailabilities(user);
    return createApiResponse(result);
  }

  @Patch('me/availabilities/:availabilityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier une disponibilite' })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_AVAILABILITY_UPDATED').message,
    messageExample: appMessage('PROFESSIONALS_AVAILABILITY_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.availabilityData,
    },
  })
  async updateMyAvailability(
    @CurrentUser() user: AuthUser,
    @Param('availabilityId') availabilityId: string,
    @Body() dto: CreateAvailabilityDto,
  ) {
    const result = await this.professionalsFacade.updateMyAvailability(
      user,
      availabilityId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_AVAILABILITY_UPDATED').message,
    );
  }

  @Delete('me/availabilities/:availabilityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.disableAvailabilitySummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_AVAILABILITY_DISABLED').message,
    messageExample: appMessage('PROFESSIONALS_AVAILABILITY_DISABLED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.professionals.availabilityData,
        estActive: false,
      },
    },
  })
  async disableMyAvailability(
    @CurrentUser() user: AuthUser,
    @Param('availabilityId') availabilityId: string,
  ) {
    const result = await this.professionalsFacade.disableMyAvailability(
      user,
      availabilityId,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_AVAILABILITY_DISABLED').message,
    );
  }

  // ─── Public Routes ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: API_DOCS.professionals.listSummary })
  @ApiQuery({
    name: 'city',
    required: false,
    type: String,
    description: API_DOCS.search.cityFilter,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: API_DOCS.search.categoryIdFilter,
  })
  @ApiQuery({
    name: 'query',
    required: false,
    type: String,
    description: API_DOCS.search.queryFilter,
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['PRESTATAIRE', 'MEDECIN'],
    description: 'Filtre les resultats par type de profil professionnel.',
  })
  @ApiQuery({
    name: 'latitude',
    required: false,
    type: Number,
    description: API_DOCS.search.latitudeFilter,
  })
  @ApiQuery({
    name: 'longitude',
    required: false,
    type: Number,
    description: API_DOCS.search.longitudeFilter,
  })
  @ApiQuery({
    name: 'radiusKm',
    required: false,
    type: Number,
    description: API_DOCS.search.radiusKmFilter,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: API_DOCS.search.pageFilter,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.search.limitFilter,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listSuccess,
    messageExample: appMessage('SEARCH_RESULTS_RETRIEVED').message,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.search.listData,
    },
    paginated: true,
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.search.coordinatesPairRequired,
    errorCode: 'SEARCH_COORDINATES_PAIR_REQUIRED',
    messageExample: API_DOCS.search.coordinatesPairRequired,
  })
  async list(@Query() query: SearchProfessionalsQueryDto) {
    const result = await this.searchQueryService.searchProfessionals({
      city: query.city,
      categoryId: query.categoryId,
      query: query.query,
      role: query.role,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const response = createPaginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
    response.message = appMessage('SEARCH_RESULTS_RETRIEVED').message;
    return response;
  }

  @Get(':id')
  @ApiOperation({ summary: API_DOCS.professionals.byIdSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.common.profileRetrieved,
    messageExample: API_DOCS.common.profileRetrieved,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.profileNotFound,
    errorCode: 'PROFESSIONALS_PROFILE_NOT_FOUND',
    messageExample: API_DOCS.common.profileNotFound,
  })
  async byId(@Param('id') id: string) {
    const result = await this.professionalsFacade.getProfessionalById(id);
    return createApiResponse(result);
  }

  @Get(':id/services')
  @ApiOperation({ summary: API_DOCS.professionals.listServicesSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listServicesSuccess,
    messageExample: API_DOCS.professionals.listServicesSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.professionals.serviceData],
    },
  })
  async services(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalServices(id);
    return createApiResponse(result);
  }

  @Get(':id/portfolio')
  @ApiOperation({ summary: API_DOCS.professionals.listPortfolioSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listPortfolioSuccess,
    messageExample: API_DOCS.professionals.listPortfolioSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.professionals.portfolioData],
    },
  })
  async portfolio(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalPortfolio(id);
    return createApiResponse(result);
  }

  @Get(':id/availabilities')
  @ApiOperation({ summary: API_DOCS.professionals.listAvailabilitiesSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listAvailabilitiesSuccess,
    messageExample: API_DOCS.professionals.listAvailabilitiesSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.professionals.availabilityData],
    },
  })
  async availabilities(@Param('id') id: string) {
    const result =
      await this.professionalsFacade.listProfessionalAvailabilities(id);
    return createApiResponse(result);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: API_DOCS.professionals.listReviewsSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.professionals.listReviewsSuccess,
    messageExample: API_DOCS.professionals.listReviewsSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.reviewsData,
    },
  })
  async reviews(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalReviews(id);
    return createApiResponse(result);
  }
}
