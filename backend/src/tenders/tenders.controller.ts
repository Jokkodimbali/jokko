import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/security/jwt-auth.guard';
import { CurrentUser } from '../auth/security/current-user.decorator';
import type { AuthUser } from '../auth/security/auth-user.type';
import { createApiResponse } from '../shared/dto/api-response.dto';
import { TendersService } from './tenders.service';
import {
  CreateTenderDto,
  RepublishTenderDto,
  RespondTenderDto,
  SelectTenderResponseDto,
  TenderListDto,
  TenderPreviewDto,
  TenderRevisionDto,
} from './tenders.dto';

@ApiTags('Appels d’offres')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenders')
export class TendersController {
  constructor(private readonly tenders: TendersService) {}
  @Get() async list(
    @CurrentUser() user: AuthUser,
    @Query() query: TenderListDto,
  ) {
    return createApiResponse(await this.tenders.list(user, query.page, query.answeredOnly));
  }
  @Post() async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateTenderDto,
  ) {
    return createApiResponse(await this.tenders.create(user, body));
  }
  @Get('preview') async preview(
    @CurrentUser() user: AuthUser,
    @Query() query: TenderPreviewDto,
  ) {
    return createApiResponse(await this.tenders.preview(user, query));
  }
  @Get(':id') async detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return createApiResponse(await this.tenders.detail(user, id));
  }
  @Post(':id/republish') async republish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RepublishTenderDto,
  ) {
    return createApiResponse(await this.tenders.republish(user, id, body));
  }
  @Post(':id/cancel') async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TenderRevisionDto,
  ) {
    return createApiResponse(
      await this.tenders.cancel(user, id, body.revision),
    );
  }
  @Post(':id/respond') async respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RespondTenderDto,
  ) {
    return createApiResponse(await this.tenders.respond(user, id, body));
  }
  @Post(':id/ignore') async ignore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TenderRevisionDto,
  ) {
    return createApiResponse(
      await this.tenders.ignore(user, id, body.revision),
    );
  }
  @Post(':id/responses/:responseId/reject') async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @Body() body: TenderRevisionDto,
  ) {
    return createApiResponse(
      await this.tenders.reject(user, id, responseId, body.revision),
    );
  }
  @Post(':id/responses/:responseId/select') async select(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('responseId', ParseUUIDPipe) responseId: string,
    @Body() body: SelectTenderResponseDto,
  ) {
    return createApiResponse(
      await this.tenders.select(
        user,
        id,
        responseId,
        body.revision,
        body.amount,
      ),
    );
  }
}
