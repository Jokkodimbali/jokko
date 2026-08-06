import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { CurrentUser } from '../../auth/security/current-user.decorator';
import { JwtAuthGuard } from '../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../shared/dto/api-response.dto';
import { CallsService } from '../application/services/calls.service';
import type { CallKind } from '../domain/call.types';

class JoinCallDto {
  @IsUUID() callId!: string;
  @IsIn(['VOICE', 'VIDEO']) kind!: CallKind;
}

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('history')
  async history(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return createApiResponse(
      await this.calls.listHistory(
        user,
        Number(limit) || 50,
        Number(offset) || 0,
      ),
    );
  }

  @Post('conversations/:conversationId/join-credential')
  async createCredential(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: JoinCallDto,
  ) {
    return createApiResponse(
      await this.calls.createJoinCredential(
        user,
        conversationId,
        dto.callId,
        dto.kind,
      ),
    );
  }
}
