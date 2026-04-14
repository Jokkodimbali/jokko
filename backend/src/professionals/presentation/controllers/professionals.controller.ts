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

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  // ─── My Profile (Authenticated) ───────────────────────────────────────────

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a professional profile' })
  @ApiResponse({ status: 201, description: 'Profile created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a PRESTATAIRE',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Profile already exists',
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
  @ApiOperation({ summary: 'Get my professional profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.me(user);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my professional profile (partial update)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
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
  @ApiOperation({ summary: 'Submit KYC documents for verification' })
  @ApiResponse({ status: 200, description: 'KYC submitted successfully' })
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
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
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
  @ApiOperation({ summary: 'Update a service (partial update)' })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
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
  @ApiOperation({ summary: 'Disable a service' })
  @ApiResponse({ status: 200, description: 'Service disabled successfully' })
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
  @ApiOperation({ summary: 'Add a portfolio item' })
  @ApiResponse({
    status: 201,
    description: 'Portfolio item created successfully',
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
  @ApiOperation({ summary: 'Delete a portfolio item' })
  @ApiResponse({
    status: 200,
    description: 'Portfolio item deleted successfully',
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
  @ApiOperation({ summary: 'Create an availability slot' })
  @ApiResponse({
    status: 201,
    description: 'Availability created successfully',
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
  @ApiOperation({ summary: 'Disable an availability slot' })
  @ApiResponse({
    status: 200,
    description: 'Availability disabled successfully',
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
  @ApiOperation({ summary: 'List verified professionals' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 50)',
  })
  @ApiResponse({ status: 200, description: 'List of verified professionals' })
  async list(@Query() query: ListProfessionalsQueryDto) {
    const result = await this.professionalsFacade.listProfessionals(query);
    return createApiResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a professional profile by ID' })
  @ApiParam({ name: 'id', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async byId(@Param('id') id: string) {
    const result = await this.professionalsFacade.getProfessionalById(id);
    return createApiResponse(result);
  }

  @Get(':id/services')
  @ApiOperation({ summary: 'List services of a professional' })
  @ApiParam({ name: 'id', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'List of services' })
  async services(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalServices(id);
    return createApiResponse(result);
  }

  @Get(':id/portfolio')
  @ApiOperation({ summary: 'List portfolio items of a professional' })
  @ApiParam({ name: 'id', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'List of portfolio items' })
  async portfolio(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalPortfolio(id);
    return createApiResponse(result);
  }

  @Get(':id/availabilities')
  @ApiOperation({ summary: 'List availabilities of a professional' })
  @ApiParam({ name: 'id', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'List of availabilities' })
  async availabilities(@Param('id') id: string) {
    const result =
      await this.professionalsFacade.listProfessionalAvailabilities(id);
    return createApiResponse(result);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'List reviews of a professional' })
  @ApiParam({ name: 'id', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async reviews(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalReviews(id);
    return createApiResponse(result);
  }
}
