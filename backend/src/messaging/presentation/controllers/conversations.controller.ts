import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { memoryStorage } from 'multer';
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
import { CloudinaryMediaService } from '../../../shared/media/cloudinary-media.service';
import { MessagingFacade } from '../../application/services/messaging-facade.service';
import { MessagingGateway } from '../gateways/messaging.gateway';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ListConversationsQueryDto } from '../dto/list-conversations-query.dto';

type UploadedConversationMediaFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

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

@ApiTags(API_DOCS.messaging.tag)
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly messagingFacade: MessagingFacade,
    private readonly messagingGateway: MessagingGateway,
    private readonly cloudinaryMedia: CloudinaryMediaService,
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
      storage: memoryStorage(),
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
  async uploadConversationMedia(
    @UploadedFile() file: UploadedConversationMediaFile | undefined,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const uploaded = await this.cloudinaryMedia
      .upload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: 'jokko/conversation-media',
      })
      .catch(() => {
        throw appHttpException('VALIDATION_REQUEST_INVALID');
      });

    return createApiResponse({
      mediaUrl: uploaded.secureUrl,
      cloudinaryPublicId: uploaded.publicId,
      cloudinaryResourceType: uploaded.resourceType,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: uploaded.bytes,
    });
  }

  @Get('media/download-url')
  @ApiOperation({ summary: 'Generer une URL de telechargement Cloudinary signee' })
  async createMediaDownloadUrl(
    @Query('mediaUrl') mediaUrl: string | undefined,
    @Query('fileName') fileName?: string,
  ) {
    if (!mediaUrl) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const download = (() => {
      try {
        return this.cloudinaryMedia.createPrivateDownloadUrl(mediaUrl, fileName);
      } catch {
        throw appHttpException('VALIDATION_REQUEST_INVALID');
      }
    })();

    return createApiResponse(download);
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
