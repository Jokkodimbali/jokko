import { Global, Module } from '@nestjs/common';
import {
  normalizeEmail,
  normalizeAddress,
  trimString,
} from './utils/string.utils';

@Global()
@Module({
  providers: [],
  exports: [normalizeEmail, normalizeAddress, trimString],
})
export class SharedModule {}
