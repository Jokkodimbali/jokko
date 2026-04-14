import { Transform } from 'class-transformer';
import { IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class UpdateMyAvatarDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: VALIDATION_MESSAGES.AVATAR_URL_INVALID })
  @IsUrl({}, { message: VALIDATION_MESSAGES.AVATAR_URL_INVALID })
  avatarUrl!: string;
}
