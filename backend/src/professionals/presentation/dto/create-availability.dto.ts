import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class CreateAvailabilityDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsInt({ message: VALIDATION_MESSAGES.DAY_OF_WEEK_INVALID })
  @Min(0, { message: VALIDATION_MESSAGES.DAY_OF_WEEK_INVALID })
  @Max(6, { message: VALIDATION_MESSAGES.DAY_OF_WEEK_INVALID })
  dayOfWeek!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.START_TIME_REQUIRED })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: VALIDATION_MESSAGES.TIME_FORMAT_INVALID,
  })
  startTime!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.END_TIME_REQUIRED })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: VALIDATION_MESSAGES.TIME_FORMAT_INVALID,
  })
  endTime!: string;
}
