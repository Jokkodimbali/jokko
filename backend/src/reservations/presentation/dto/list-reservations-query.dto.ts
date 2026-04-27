import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VALIDATION_MESSAGES } from '../../../core/http/app-messages';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

export class ListReservationsQueryDto {
  @ApiPropertyOptional({ description: API_DOCS.reservations.startDateField })
  @IsOptional()
  @IsDateString(
    {},
    { message: VALIDATION_MESSAGES.RESERVATION_QUERY_DATE_INVALID },
  )
  startDate?: string;

  @ApiPropertyOptional({ description: API_DOCS.reservations.endDateField })
  @IsOptional()
  @IsDateString(
    {},
    { message: VALIDATION_MESSAGES.RESERVATION_QUERY_DATE_INVALID },
  )
  endDate?: string;

  @ApiPropertyOptional({
    description: API_DOCS.reservations.scopeField,
    enum: ['CLIENT', 'PRESTATAIRE'],
  })
  @IsOptional()
  @IsIn(['CLIENT', 'PRESTATAIRE'], {
    message: VALIDATION_MESSAGES.NON_WHITELISTED_FIELD,
  })
  scope?: 'CLIENT' | 'PRESTATAIRE';

  @ApiPropertyOptional({ description: API_DOCS.reservations.statusField })
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

  @ApiPropertyOptional({
    description: API_DOCS.reservations.serviceFilterField,
  })
  @IsOptional()
  @IsUUID('4', { message: VALIDATION_MESSAGES.SERVICE_ID_FORMAT })
  serviceId?: string;
}
