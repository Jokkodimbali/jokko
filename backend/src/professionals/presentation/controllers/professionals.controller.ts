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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProfessionalsFacade } from '../../application/services/professionals-facade.service';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appMessage } from '../../../core/http/app-http.exception';
import { CreateProfessionalProfileDto } from '../dto/create-professional-profile.dto';
import { SubmitKycDto } from '../dto/submit-kyc.dto';
import { ListProfessionalsQueryDto } from '../dto/list-professionals-query.dto';
import { UpdateProfessionalProfileDto } from '../dto/update-professional-profile.dto';
import { CreateProfessionalServiceDto } from '../dto/create-professional-service.dto';
import { UpdateProfessionalServiceDto } from '../dto/update-professional-service.dto';
import { CreatePortfolioItemDto } from '../dto/create-portfolio-item.dto';
import { CreateAvailabilityDto } from '../dto/create-availability.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.professionals.tag)
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  // ─── My Profile (Authenticated) ───────────────────────────────────────────

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createProfileSummary })
  @ApiResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_PROFILE_CREATED').message,
  })
  @ApiResponse({
    status: 403,
    description: API_DOCS.professionals.createProfileForbidden,
  })
  @ApiResponse({
    status: 409,
    description: API_DOCS.professionals.createProfileConflict,
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
  @ApiResponse({ status: 200, description: API_DOCS.common.profileRetrieved })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.me(user);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.updateSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_PROFILE_UPDATED').message,
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
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
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
  @ApiResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_SERVICE_CREATED').message,
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

  @Patch('me/services/:serviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.updateServiceSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_SERVICE_UPDATED').message,
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
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_SERVICE_DISABLED').message,
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
  @ApiResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_CREATED').message,
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
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_PORTFOLIO_ITEM_DELETED').message,
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

  @Post('me/availabilities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.professionals.createAvailabilitySummary })
  @ApiResponse({
    status: 201,
    description: appMessage('PROFESSIONALS_AVAILABILITY_CREATED').message,
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

  @Delete('me/availabilities/:availabilityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.professionals.disableAvailabilitySummary })
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_AVAILABILITY_DISABLED').message,
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
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: API_DOCS.professionals.pageDescription,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.professionals.limitDescription,
  })
  @ApiResponse({ status: 200, description: API_DOCS.professionals.listSuccess })
  async list(@Query() query: ListProfessionalsQueryDto) {
    const result = await this.professionalsFacade.listProfessionals(query);
    return createApiResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: API_DOCS.professionals.byIdSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.professionals.professionalIdParam,
  })
  @ApiResponse({ status: 200, description: API_DOCS.common.profileRetrieved })
  @ApiResponse({ status: 404, description: API_DOCS.common.profileNotFound })
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
  @ApiResponse({
    status: 200,
    description: API_DOCS.professionals.listServicesSuccess,
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
  @ApiResponse({
    status: 200,
    description: API_DOCS.professionals.listPortfolioSuccess,
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
  @ApiResponse({
    status: 200,
    description: API_DOCS.professionals.listAvailabilitiesSuccess,
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
  @ApiResponse({
    status: 200,
    description: API_DOCS.professionals.listReviewsSuccess,
  })
  async reviews(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalReviews(id);
    return createApiResponse(result);
  }
}
