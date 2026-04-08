import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
export declare function buildValidationException(errors: ValidationError[]): BadRequestException;
