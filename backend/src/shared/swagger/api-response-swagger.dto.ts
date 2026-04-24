import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

type SwaggerDto = Type<unknown>;

type SwaggerPrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'integer'
  | 'null';

interface SwaggerPrimitiveSchema {
  type: SwaggerPrimitiveType;
  example?: string | number | boolean | null;
  nullable?: boolean;
}

interface SwaggerArraySchema {
  type: 'array';
  items: SwaggerSchema;
  example?: unknown[] | readonly unknown[];
}

interface SwaggerObjectSchema {
  type: 'object';
  properties?: Record<string, SwaggerSchema>;
  additionalProperties?: boolean;
  nullable?: boolean;
  example?: Record<string, unknown>;
}

interface SwaggerRefSchema {
  $ref: string;
}

type SwaggerSchema =
  | SwaggerPrimitiveSchema
  | SwaggerArraySchema
  | SwaggerObjectSchema
  | SwaggerRefSchema;

interface SuccessResponseOptions {
  status: number;
  description: string;
  messageExample?: string;
  dataDto?: SwaggerDto;
  dataSchema?: SwaggerSchema;
  isArray?: boolean;
  paginated?: boolean;
}

interface ErrorResponseOptions {
  status: number;
  description: string;
  errorCode: string;
  messageExample?: string;
}

export class PaginationSwaggerDto {
  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 2 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNext!: boolean;

  @ApiProperty({ example: false })
  hasPrevious!: boolean;
}

export class ApiMetaSwaggerDto {
  @ApiPropertyOptional({ type: () => PaginationSwaggerDto })
  pagination?: PaginationSwaggerDto;
}

export class ApiSuccessEnvelopeSwaggerDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiPropertyOptional({
    example: 'Operation effectuee avec succes.',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Charge utile retournee par le backend.',
    type: 'object',
    additionalProperties: true,
  })
  data?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'Metadonnees retournees par le backend.',
    type: () => ApiMetaSwaggerDto,
  })
  meta?: ApiMetaSwaggerDto;
}

export class ApiErrorSwaggerDto {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'VALIDATION_REQUEST_INVALID' })
  errorCode!: string;

  @ApiProperty({ example: 'Les donnees envoyees sont invalides.' })
  message!: string;

  @ApiProperty({ example: '2026-04-24T10:00:00.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({ example: '/api/v1/auth/login' })
  path?: string;
}

function buildSuccessDataSchema(
  options: SuccessResponseOptions,
): SwaggerSchema {
  if (options.dataSchema) {
    return options.dataSchema;
  }

  if (options.dataDto) {
    if (options.isArray) {
      return {
        type: 'array',
        items: { $ref: getSchemaPath(options.dataDto) },
      };
    }

    return { $ref: getSchemaPath(options.dataDto) };
  }

  return {
    type: 'object',
    additionalProperties: true,
  };
}

export function ApiStandardSuccessResponse(options: SuccessResponseOptions) {
  const extraModels: SwaggerDto[] = [
    ApiSuccessEnvelopeSwaggerDto,
    ApiMetaSwaggerDto,
    PaginationSwaggerDto,
  ];

  if (options.dataDto) {
    extraModels.push(options.dataDto);
  }

  const metaSchema: SwaggerSchema = options.paginated
    ? {
        type: 'object',
        properties: {
          pagination: { $ref: getSchemaPath(PaginationSwaggerDto) },
        },
      }
    : {
        type: 'object',
        additionalProperties: true,
        nullable: true,
      };

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [{ $ref: getSchemaPath(ApiSuccessEnvelopeSwaggerDto) }],
        properties: {
          success: { type: 'boolean', example: true },
          message: {
            type: 'string',
            example: options.messageExample ?? options.description,
          },
          data: buildSuccessDataSchema(options),
          meta: metaSchema,
        },
      },
    }),
  );
}

export function ApiStandardErrorResponse(options: ErrorResponseOptions) {
  return applyDecorators(
    ApiExtraModels(ApiErrorSwaggerDto),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        allOf: [{ $ref: getSchemaPath(ApiErrorSwaggerDto) }],
        example: {
          success: false,
          statusCode: options.status,
          errorCode: options.errorCode,
          message: options.messageExample ?? options.description,
          timestamp: '2026-04-24T10:00:00.000Z',
          path: '/api/v1/endpoint-de-reference',
        },
      },
    }),
  );
}
