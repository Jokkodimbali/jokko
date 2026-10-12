import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { AuthUser } from '../auth/security/auth-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import type { TenderMatchingService } from './tender-matching.service';
import type { TenderNotificationsService } from './tender-notifications.service';
import { TendersService } from './tenders.service';

const client = { sub: 'client', role: 'CLIENT' } as AuthUser;
const doctor = { sub: 'doctor', role: 'MEDECIN' } as AuthUser;
const input = {
  categoryId: 'medical-category',
  description: 'Une consultation de médecine générale',
  address: 'Dakar',
  latitude: 14.69,
  longitude: -17.46,
  radiusKm: 25,
  proposedPrice: 10000,
};

it('excludes doctors and rejects medical catalogue categories before matching', async () => {
  const prisma = {
    categorie: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const matching = { findRecipients: jest.fn() };
  const service = new TendersService(
    prisma as unknown as PrismaService,
    matching as unknown as TenderMatchingService,
    { send: jest.fn() } as unknown as TenderNotificationsService,
  );

  await expect(service.list(doctor, 1)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  await expect(
    service.respond(doctor, 'request', {
      revision: 1,
      serviceId: 'service',
      amount: 10000,
    }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(service.create(client, input)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(prisma.categorie.findFirst).toHaveBeenCalledWith({
    where: expect.objectContaining({ typeEspace: 'PRESTATAIRE' }),
  });
  expect(matching.findRecipients).not.toHaveBeenCalled();
});

it('filters unanswered client requests before pagination', async () => {
  const prisma = {
    tender: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const service = new TendersService(
    prisma as unknown as PrismaService,
    {} as TenderMatchingService,
    {} as TenderNotificationsService,
  );

  await service.list(client, 2, true);
  const where = {
    clientId: 'client',
    status: { not: 'CANCELLED' },
    responses: { some: { status: { in: ['OFFERED', 'SELECTED'] } } },
  };
  expect(prisma.tender.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where, skip: 20, take: 20 }),
  );
  expect(prisma.tender.count).toHaveBeenCalledWith({ where });
});

it('keeps cancelled requests out of the provider inbox', async () => {
  const prisma = {
    tender: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const service = new TendersService(
    prisma as unknown as PrismaService,
    {} as TenderMatchingService,
    {} as TenderNotificationsService,
  );
  await service.list({ sub: 'provider', role: 'PRESTATAIRE' } as AuthUser, 1);
  expect(prisma.tender.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: { not: 'CANCELLED' },
        responses: { some: { professional: { utilisateurId: 'provider' } } },
      },
    }),
  );
});

it('does not publish a request that cannot notify any nearby provider', async () => {
  const prisma = {
    categorie: { findFirst: jest.fn().mockResolvedValue({ nom: 'Plomberie' }) },
    tender: { create: jest.fn() },
  };
  const notifications = { send: jest.fn() };
  const service = new TendersService(
    prisma as unknown as PrismaService,
    { findRecipients: jest.fn().mockResolvedValue([]) } as unknown as TenderMatchingService,
    notifications as unknown as TenderNotificationsService,
  );
  await expect(service.create(client, { ...input, categoryId: 'plomberie' })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(prisma.tender.create).not.toHaveBeenCalled();
  expect(notifications.send).not.toHaveBeenCalled();
});
