import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  InvoiceTemplateService,
  DEFAULT_INVOICE_TEMPLATE,
} from './invoice-template.service';
import { InvoicesController } from './invoices.controller';
import { ROLES_KEY } from '../shared/guards/roles.guard';

describe('Global invoice template', () => {
  const prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
  const service = new InvoiceTemplateService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses defaults before the administrator saves a template', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await service.get()).toEqual(DEFAULT_INVOICE_TEMPLATE);
  });

  it('ignores previously stored note and logo rounding settings', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        template: {
          ...DEFAULT_INVOICE_TEMPLATE,
          note: 'Ancienne note',
          logoRadius: 50,
        },
      },
    ]);
    const template = await service.get();
    expect(template).toEqual(DEFAULT_INVOICE_TEMPLATE);
    expect(template).not.toHaveProperty('note');
    expect(template).not.toHaveProperty('logoRadius');
  });

  it('persists only template fields, never supplied billing data', async () => {
    const saved = await service.update({
      ...DEFAULT_INVOICE_TEMPLATE,
      brandName: '  JOKKO  ',
      total: 999,
    } as typeof DEFAULT_INVOICE_TEMPLATE);
    expect(saved.brandName).toBe('JOKKO');
    expect(saved).not.toHaveProperty('total');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it.each([
    'javascript:alert(1)',
    'https://example.com/image.png',
    'https://res.cloudinary.com/demo/image/upload/other/logo.png',
  ])('rejects untrusted image %s', async (logoUrl) => {
    await expect(
      service.update({ ...DEFAULT_INVOICE_TEMPLATE, logoUrl }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('accepts images uploaded into the invoice folder', async () => {
    const signatureUrl =
      'https://res.cloudinary.com/demo/image/upload/v123/jokko/invoices/signature.png';
    expect(
      (await service.update({ ...DEFAULT_INVOICE_TEMPLATE, signatureUrl }))
        .signatureUrl,
    ).toBe(signatureUrl);
  });

  it.each(['settings', 'save', 'upload'] as const)(
    'restricts %s to administrators',
    (name) => {
      expect(
        Reflect.getMetadata(ROLES_KEY, InvoicesController.prototype[name]),
      ).toEqual(['ADMIN']);
    },
  );
});
