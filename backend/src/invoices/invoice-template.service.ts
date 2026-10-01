import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceTemplateDto } from './invoice-template.dto';

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateDto = {
  brandName: 'JOKKO Dimbali',
  footerText: 'Tous les services au Sénégal',
  feesLabel: 'Frais de service JOKKO inclus',
  logoUrl: '/logojokko.png',
  signatureUrl: '',
  stampUrl: '',
};

@Injectable()
export class InvoiceTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<InvoiceTemplateDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{ template: InvoiceTemplateDto }>
    >`
      SELECT template FROM invoice_settings WHERE id = 1
    `;
    const stored = rows[0]?.template;
    return {
      brandName: stored?.brandName ?? DEFAULT_INVOICE_TEMPLATE.brandName,
      footerText: stored?.footerText ?? DEFAULT_INVOICE_TEMPLATE.footerText,
      feesLabel: stored?.feesLabel ?? DEFAULT_INVOICE_TEMPLATE.feesLabel,
      logoUrl: stored?.logoUrl ?? DEFAULT_INVOICE_TEMPLATE.logoUrl,
      signatureUrl:
        stored?.signatureUrl ?? DEFAULT_INVOICE_TEMPLATE.signatureUrl,
      stampUrl: stored?.stampUrl ?? DEFAULT_INVOICE_TEMPLATE.stampUrl,
    };
  }

  async update(input: InvoiceTemplateDto): Promise<InvoiceTemplateDto> {
    const template = {
      brandName: input.brandName.trim(),
      footerText: input.footerText.trim(),
      feesLabel: input.feesLabel.trim(),
      logoUrl: input.logoUrl.trim(),
      signatureUrl: input.signatureUrl.trim(),
      stampUrl: input.stampUrl.trim(),
    };
    if (!template.brandName)
      throw new BadRequestException('Le nom affiché est obligatoire.');
    for (const [key, value] of Object.entries(template)) {
      if (
        !key.endsWith('Url') ||
        !value ||
        (key === 'logoUrl' && value === '/logojokko.png')
      )
        continue;
      let url: URL;
      try {
        url = new URL(String(value));
      } catch {
        throw new BadRequestException('Image invalide.');
      }
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'res.cloudinary.com' ||
        !/^\/[^/]+\/image\/upload\/(?:v\d+\/)?jokko\/invoices\//.test(
          url.pathname,
        )
      ) {
        throw new BadRequestException(
          'Importez les images depuis les paramètres de facture.',
        );
      }
    }
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO invoice_settings (id, template, updated_at)
      VALUES (1, ${JSON.stringify(template)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET template = EXCLUDED.template, updated_at = NOW()
    `);
    return template;
  }
}
