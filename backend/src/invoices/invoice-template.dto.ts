import { IsString, MaxLength } from 'class-validator';

export class InvoiceTemplateDto {
  @IsString() @MaxLength(120) brandName!: string;
  @IsString() @MaxLength(300) footerText!: string;
  @IsString() @MaxLength(80) feesLabel!: string;
  @IsString() @MaxLength(2048) logoUrl!: string;
  @IsString() @MaxLength(2048) signatureUrl!: string;
  @IsString() @MaxLength(2048) stampUrl!: string;
}
