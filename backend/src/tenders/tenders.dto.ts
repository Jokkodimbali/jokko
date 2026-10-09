import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class TenderPriceDto {
  @IsInt() @Min(500) @Max(99999999) proposedPrice!: number;
}
export class CreateTenderDto extends TenderPriceDto {
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() subCategoryId?: string;
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(180) address!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsInt() @Min(1) @Max(25) radiusKm: number = 25;
  @IsOptional() @IsDateString() scheduledAt?: string;
}
export class TenderRevisionDto {
  @IsInt() @Min(1) revision!: number;
}
export class RepublishTenderDto extends TenderRevisionDto {
  @IsInt() @Min(500) @Max(99999999) proposedPrice!: number;
}
export class SelectTenderResponseDto extends TenderRevisionDto {
  @IsInt() @Min(500) @Max(99999999) amount!: number;
}
export class RespondTenderDto extends TenderRevisionDto {
  @IsUUID() serviceId!: string;
  @IsInt() @Min(500) @Max(99999999) amount!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) message?: string;
}
export class TenderListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  answeredOnly = false;
}

export class TenderPreviewDto {
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() subCategoryId?: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
}
