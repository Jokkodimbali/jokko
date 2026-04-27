import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { VALIDATION_MESSAGES } from '../../../core/http/message-catalog';

export class UpdateMyAvatarDto {
  @ApiProperty({
    description: 'URL de la nouvelle photo de profil',
    example: 'https://cdn.jokko.sn/avatars/user-456.png',
    format: 'uri',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty({ message: VALIDATION_MESSAGES.AVATAR_URL_REQUIRED })
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: VALIDATION_MESSAGES.AVATAR_URL_INVALID },
  )
  avatarUrl!: string;
}
