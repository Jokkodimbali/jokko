import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/security/current-user.decorator';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../shared/dto/api-response.dto';
import { FavoritesService } from '../application/favorites.service';

@ApiTags('Favoris')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister mes prestataires favoris' })
  async list(@CurrentUser() user: AuthUser) {
    const result = await this.favoritesService.list(user.sub);
    return createApiResponse(result, 'Favoris recuperes avec succes.');
  }

  @Get('professionals/:professionalId/status')
  @ApiOperation({ summary: "Verifier si un prestataire est dans mes favoris" })
  async status(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.favoritesService.status(user.sub, professionalId);
    return createApiResponse(result, 'Statut favori recupere avec succes.');
  }

  @Post('professionals/:professionalId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter un prestataire a mes favoris' })
  async add(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.favoritesService.add(user.sub, professionalId);
    return createApiResponse(result, 'Prestataire ajoute aux favoris.');
  }

  @Delete('professionals/:professionalId')
  @ApiOperation({ summary: 'Retirer un prestataire de mes favoris' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.favoritesService.remove(user.sub, professionalId);
    return createApiResponse(result, 'Prestataire retire des favoris.');
  }
}
