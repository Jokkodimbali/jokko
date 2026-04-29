import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { MessagingFacade } from '../../application/services/messaging-facade.service';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';

@ApiTags(API_DOCS.messaging.tag)
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly messagingFacade: MessagingFacade,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: API_DOCS.messaging.listConversationsSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.messaging.listConversationsSuccess,
    messageExample: API_DOCS.messaging.listConversationsSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.messaging.conversationData],
    },
  })
  async listConversations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    const result = await this.messagingFacade.listConversations(user, query);
    return createApiResponse(result);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.messaging.createConversationSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.messaging.createConversationSuccess,
    messageExample: appMessage('MESSAGING_CONVERSATION_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.messaging.conversationData,
    },
  })
  async createConversation(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ) {
    const result = await this.messagingFacade.createConversation(user, dto);
    return createApiResponse(
      result,
      appMessage('MESSAGING_CONVERSATION_CREATED').message,
    );
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: API_DOCS.messaging.listMessagesSummary })
  @ApiParam({
    name: 'conversationId',
    description: API_DOCS.messaging.conversationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.messaging.listMessagesSuccess,
    messageExample: appMessage('MESSAGING_MESSAGES_RETRIEVED').message,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: [SWAGGER_RESPONSE_EXAMPLES.messaging.messageData],
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('MESSAGING_NOT_FOUND').message,
    errorCode: 'MESSAGING_NOT_FOUND',
    messageExample: appMessage('MESSAGING_NOT_FOUND').message,
  })
  async listMessages(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: ListConversationsQueryDto,
  ) {
    const result = await this.messagingFacade.listMessages(
      user,
      conversationId,
      query,
    );
    return createApiResponse(
      result,
      appMessage('MESSAGING_MESSAGES_RETRIEVED').message,
    );
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.messaging.sendMessageSummary })
  @ApiParam({
    name: 'conversationId',
    description: API_DOCS.messaging.conversationIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.messaging.sendMessageSuccess,
    messageExample: appMessage('MESSAGING_MESSAGE_SENT').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.messaging.messageData,
    },
  })
  async sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const result = await this.messagingFacade.sendMessage(
      user,
      conversationId,
      dto,
    );
    this.messagingGateway.publishMessageCreated(
      result.message,
      result.recipientUserId,
    );
    return createApiResponse(
      result.message,
      appMessage('MESSAGING_MESSAGE_SENT').message,
    );
  }
}
