import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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

@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
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

  @Patch('kyc/submit')
  @UseGuards(JwtAuthGuard)
  async submitKyc(@CurrentUser() user: AuthUser, @Body() dto: SubmitKycDto) {
    const result = await this.professionalsFacade.submitKyc(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
    );
  }

  @Post('me/kyc')
  @UseGuards(JwtAuthGuard)
  async submitMyKyc(@CurrentUser() user: AuthUser, @Body() dto: SubmitKycDto) {
    const result = await this.professionalsFacade.submitKyc(user, dto);
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_KYC_SUBMITTED').message,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.professionalsFacade.me(user);
    return createApiResponse(result);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
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

  @Post('me/services')
  @UseGuards(JwtAuthGuard)
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

  @Put('me/services/:serviceId')
  @UseGuards(JwtAuthGuard)
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

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard)
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

  @Post('me/availabilities')
  @UseGuards(JwtAuthGuard)
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

  @Get()
  async list(@Query() query: ListProfessionalsQueryDto) {
    const result = await this.professionalsFacade.listProfessionals(query);
    return createApiResponse(result);
  }

  @Get(':id/services')
  async services(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalServices(id);
    return createApiResponse(result);
  }

  @Get(':id/portfolio')
  async portfolio(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalPortfolio(id);
    return createApiResponse(result);
  }

  @Get(':id/availabilities')
  async availabilities(@Param('id') id: string) {
    const result =
      await this.professionalsFacade.listProfessionalAvailabilities(id);
    return createApiResponse(result);
  }

  @Get(':id/reviews')
  async reviews(@Param('id') id: string) {
    const result = await this.professionalsFacade.listProfessionalReviews(id);
    return createApiResponse(result);
  }

  @Get(':id')
  async byId(@Param('id') id: string) {
    const result = await this.professionalsFacade.getProfessionalById(id);
    return createApiResponse(result);
  }
}
