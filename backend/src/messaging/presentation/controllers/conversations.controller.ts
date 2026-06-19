import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { DiskStorageCallback, DiskStorageFile } from 'multer';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { buildPublicUploadUrl } from '../../../shared/http/public-upload-url';
import { MessagingFacade } from '../../application/services/messaging-facade.service';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';

type UploadedConversationMediaFile = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

const conversationMediaUploadDirectory = join(
  process.cwd(),
  'uploads',
  'conversation-media',
);

const allowedConversationMediaMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
]);

function ensureConversationMediaUploadDirectory(): void {
  mkdirSync(conversationMediaUploadDirectory, { recursive: true });
}

function buildConversationMediaFileName(originalName: string): string {
  const extension = extname(originalName).toLowerCase() || '.bin';
  const safeExtension = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.txt',
    '.webm',
    '.mp3',
    '.m4a',
    '.ogg',
    '.wav',
  ].includes(extension)
    ? extension
    : '.bin';
  return `conversation-media-${Date.now()}-${randomUUID()}${safeExtension}`;
}

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

  @Post('media')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('media', {
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          ensureConversationMediaUploadDirectory();
          callback(null, conversationMediaUploadDirectory);
        },
        filename: (
          _request: unknown,
          file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          callback(null, buildConversationMediaFileName(file.originalname));
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedConversationMediaMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un media pour une conversation' })
  uploadConversationMedia(
    @UploadedFile() file: UploadedConversationMediaFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    return createApiResponse({
      mediaUrl: buildPublicUploadUrl(
        request,
        `/uploads/conversation-media/${file.filename}`,
      ),
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
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
