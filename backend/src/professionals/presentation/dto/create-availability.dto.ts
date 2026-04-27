import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreateAvailabilityDto {
  @ApiProperty({
    description: 'Jour de la semaine (0=Dimanche, 6=Samedi)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsNotEmpty()
  @IsInt({ message: VALIDATION_MESSAGES.DAY_OF_WEEK_MUST_BE_INTEGER })
  @Min(0, { message: VALIDATION_MESSAGES.DAY_OF_WEEK_INVALID })
  @Max(6, { message: VALIDATION_MESSAGES.DAY_OF_WEEK_INVALID })
  dayOfWeek!: number;

  @ApiProperty({
    description: 'Heure de debut (format HH:mm)',
    example: '09:00',
    pattern: String.raw`^([01]\d|2[0-3]):([0-5]\d)$`,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.START_TIME_REQUIRED })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: VALIDATION_MESSAGES.TIME_FORMAT_INVALID,
  })
  startTime!: string;

  @ApiProperty({
    description: 'Heure de fin (format HH:mm)',
    example: '17:00',
    pattern: String.raw`^([01]\d|2[0-3]):([0-5]\d)$`,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.END_TIME_REQUIRED })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: VALIDATION_MESSAGES.TIME_FORMAT_INVALID,
  })
  endTime!: string;
}
