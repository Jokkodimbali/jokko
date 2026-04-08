import { HttpException } from '@nestjs/common';
import { type AppMessageKey, type AppMessageDefinition } from './message-catalog';
export declare function appMessage(key: AppMessageKey): AppMessageDefinition;
export declare function appHttpException(key: AppMessageKey, details?: unknown): HttpException;
