import { IsIn, IsUUID } from 'class-validator';
import type { CallKind } from '../domain/call.types';

export class CallSignalDto {
  @IsUUID()
  callId!: string;

  @IsUUID()
  conversationId!: string;

  @IsIn(['VOICE', 'VIDEO'])
  kind!: CallKind;
}
