import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';

export class ListReservationsQueryDto {
  @ApiPropertyOptional({ description: 'Date de debut en ISO 8601' })
  @IsOptional()
  @IsDateString(
    {},
    { message: VALIDATION_MESSAGES.RESERVATION_QUERY_DATE_INVALID },
  )
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin en ISO 8601' })
  @IsOptional()
  @IsDateString(
    {},
    { message: VALIDATION_MESSAGES.RESERVATION_QUERY_DATE_INVALID },
  )
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Vue souhaitee pour un compte prestataire: CLIENT ou PRESTATAIRE',
    enum: ['CLIENT', 'PRESTATAIRE'],
  })
  @IsOptional()
  @IsIn(['CLIENT', 'PRESTATAIRE'], {
    message: VALIDATION_MESSAGES.NON_WHITELISTED_FIELD,
  })
  scope?: 'CLIENT' | 'PRESTATAIRE';

  @ApiPropertyOptional({ description: 'Filtrer par statut' })
  @IsOptional()
  @IsIn(
    [
      'EN_ATTENTE',
      'CONFIRMEE',
      'PAYEE_SEQUESTRE',
      'EN_COURS',
      'TERMINEE',
      'ANNULEE',
      'NO_SHOW',
      'LITIGE',
    ],
    {
      message: VALIDATION_MESSAGES.NON_WHITELISTED_FIELD,
    },
  )
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrer par service' })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.SERVICE_ID_FORMAT })
  serviceId?: string;
}
