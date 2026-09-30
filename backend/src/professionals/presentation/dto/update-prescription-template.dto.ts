import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePrescriptionTemplateDto {
  @IsOptional() @IsString() @MaxLength(160) tutelle?: string;
  @IsOptional() @IsString() @MaxLength(160) region?: string;
  @IsOptional() @IsString() @MaxLength(160) structure?: string;
  @IsOptional() @IsString() @MaxLength(160) prescripteur?: string;
  @IsOptional() @IsString() @MaxLength(160) qualification?: string;
  @IsOptional() @IsString() @MaxLength(240) adresse?: string;
  @IsOptional() @IsString() @MaxLength(40) telephone?: string;
  @IsOptional() @IsString() @MaxLength(300) piedDePage?: string;
  @IsOptional() @IsString() @MaxLength(2048) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) signatureUrl?: string;
  @IsOptional() @IsString() @MaxLength(2048) cachetUrl?: string;
}
