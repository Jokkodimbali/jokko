import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatutCommandePharmacie, StatutKyc } from '@prisma/client';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { PharmacyOrdersService } from './pharmacy-orders.service';

describe('PharmacyOrdersService', () => {
  const patient = {
    sub: '11111111-1111-4111-8111-111111111111',
    role: 'CLIENT',
  } as AuthUser;
  const pharmacyUser = {
    sub: '22222222-2222-4222-8222-222222222222',
    role: 'PRESTATAIRE',
  } as AuthUser;
  const pharmacyId = '33333333-3333-4333-8333-333333333333';
  const reservationId = '44444444-4444-4444-8444-444444444444';
  const baseOrder = {
    id: '55555555-5555-4555-8555-555555555555',
    statut: StatutCommandePharmacie.EN_ATTENTE_PHARMACIE,
    montantMedicaments: null,
    detailsMedicaments: [],
    notePharmacie: null,
    indisponibilites: [],
    valideePharmacieLe: null,
    creeLe: new Date('2026-08-21T12:00:00.000Z'),
    reservationMedicale: {
      id: reservationId,
      dateHeure: new Date('2026-08-21T10:00:00.000Z'),
      actesPrescriptionMedicale: ['Consultation'],
      vaccinsPrescriptionMedicale: [],
      traitementsPrescriptionMedicale: ['Paracetamol'],
      service: {
        nom: 'Consultation medicale',
        categorie: { nom: 'Sante et medecine' },
      },
      professionnel: {
        noteGlobale: 4.8,
        nombreAvis: 24,
        utilisateur: {
          nom: 'Dr Aminata Diop',
          urlAvatar: 'https://example.test/doctor.jpg',
        },
      },
    },
    client: {
      id: patient.sub,
      nom: 'Patient Jokko',
      numeroTelephone: null,
      adresse: null,
    },
    pharmacie: {
      id: pharmacyId,
      nomEntreprise: 'Pharmacie Jokko',
      utilisateur: { id: pharmacyUser.sub, nom: 'Pharmacien Jokko' },
    },
  };
  const prisma = {
    $queryRaw: jest.fn(),
    reservation: { findFirst: jest.fn() },
    profilProfessionnel: { findFirst: jest.fn(), findUnique: jest.fn() },
    commandePharmacie: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const notifications = { createInAppNotification: jest.fn() };
  const geocodeAddress = { execute: jest.fn() };
  const computeRoutes = { execute: jest.fn() };
  const service = new PharmacyOrdersService(
    prisma as never,
    notifications as never,
    geocodeAddress as never,
    computeRoutes as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('exposes pharmacy space access only for a verified pharmacy profile', async () => {
    prisma.profilProfessionnel.findFirst.mockResolvedValue({ id: pharmacyId });

    await expect(service.getAccess(pharmacyUser)).resolves.toEqual({
      isPharmacy: true,
    });
    expect(prisma.profilProfessionnel.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        utilisateurId: pharmacyUser.sub,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
      }),
      select: { id: true },
    });
  });

  it('notifies the selected pharmacy when a patient sends a completed medical prescription', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: reservationId,
      service: {
        nom: 'Consultation medicale',
        categorie: { nom: 'Sante et medecine' },
      },
    });
    prisma.profilProfessionnel.findFirst.mockResolvedValue({ id: pharmacyId });
    prisma.commandePharmacie.create.mockResolvedValue(baseOrder);

    const result = await service.create(patient, {
      medicalReservationId: reservationId,
      pharmacyId,
    });

    expect(result.medicalReservation.prescriber).toEqual({
      name: 'Dr Aminata Diop',
      avatarUrl: 'https://example.test/doctor.jpg',
      specialty: 'Sante et medecine',
      rating: 4.8,
      totalReviews: 24,
    });

    expect(prisma.profilProfessionnel.findFirst).toHaveBeenCalledWith({
      where: {
        id: pharmacyId,
        estPharmacie: true,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: { estActif: true },
      },
      select: { id: true },
    });

    expect(notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: pharmacyUser.sub,
        type: 'ORDONNANCE_RECUE',
        data: expect.objectContaining({ pharmacyOrderId: baseOrder.id }),
      }),
    );
  });

  it('rejects a verified professional that is not registered as a pharmacy', async () => {
    prisma.reservation.findFirst.mockResolvedValue({
      id: reservationId,
      service: {
        nom: 'Consultation medicale',
        categorie: { nom: 'Sante et medecine' },
      },
    });
    prisma.profilProfessionnel.findFirst.mockResolvedValue(null);

    await expect(
      service.create(patient, {
        medicalReservationId: reservationId,
        pharmacyId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.commandePharmacie.create).not.toHaveBeenCalled();
  });

  it('returns nearby verified pharmacies with numeric distances', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: pharmacyId,
        name: 'Pharmacie Jokko',
        address: 'Dakar',
        city: 'Dakar',
        latitude: 14.7167,
        longitude: -17.4677,
        distanceKm: '2.45',
        rating: '4.8',
        totalReviews: 32,
      },
    ]);

    const result = await service.listNearbyPharmacies({
      latitude: 14.7,
      longitude: -17.4,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: pharmacyId,
        distanceKm: 2.45,
        rating: 4.8,
        totalReviews: 32,
      }),
    ]);
    const query = prisma.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
      values: readonly unknown[];
    };
    expect(query.strings.join(' ')).toContain('p.is_pharmacy = true');
    expect(query.strings.join(' ')).toContain("p.kyc_status = 'VERIFIE'");
    expect(query.strings.join(' ')).toContain('u.is_active = true');
    expect(query.strings.join(' ')).toContain(
      'ORDER BY "distanceKm" ASC LIMIT 50',
    );
    expect(query.values).toContain(25_000);
  });

  it('caps the nearby search radius at 100 km', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await service.listNearbyPharmacies({
      latitude: 14.7,
      longitude: -17.4,
      radiusKm: 250,
    });

    const query = prisma.$queryRaw.mock.calls[0][0] as {
      values: readonly unknown[];
    };
    expect(query.values).toContain(100_000);
  });

  it('notifies the patient of the fixed amount after pharmacy validation', async () => {
    const validatedOrder = {
      ...baseOrder,
      statut: StatutCommandePharmacie.EN_ATTENTE_PAIEMENT,
      montantMedicaments: 12500,
      valideePharmacieLe: new Date(),
    };
    prisma.profilProfessionnel.findUnique.mockResolvedValue({
      id: pharmacyId,
      estPharmacie: true,
      statutKyc: StatutKyc.VERIFIE,
    });
    prisma.commandePharmacie.findFirst
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(validatedOrder);
    prisma.commandePharmacie.updateMany.mockResolvedValue({ count: 1 });

    await service.validate(pharmacyUser, baseOrder.id, {
      status: 'EN_ATTENTE_PAIEMENT',
      medicineItems: [
        { position: 0, name: 'Consultation', isAvailable: true, price: 5000 },
        { position: 1, name: 'Paracetamol', isAvailable: true, price: 7500 },
      ],
    });

    expect(notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: patient.sub,
        type: 'ORDONNANCE_MISE_A_JOUR',
        body: expect.stringContaining('FCFA'),
      }),
    );
    expect(prisma.commandePharmacie.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: baseOrder.id,
          pharmacieId: pharmacyId,
          statut: StatutCommandePharmacie.EN_ATTENTE_PHARMACIE,
        }),
      }),
    );
  });

  it('rejects validation from a professional profile that is not a verified pharmacy', async () => {
    prisma.profilProfessionnel.findUnique.mockResolvedValue({
      id: pharmacyId,
      estPharmacie: false,
      statutKyc: StatutKyc.VERIFIE,
    });

    await expect(
      service.validate(pharmacyUser, baseOrder.id, {
        status: 'EN_ATTENTE_PAIEMENT',
        medicineItems: [
          { position: 0, name: 'Consultation', isAvailable: true, price: 5000 },
          { position: 1, name: 'Paracetamol', isAvailable: true, price: 7500 },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.commandePharmacie.updateMany).not.toHaveBeenCalled();
  });

  it('requires unavailable items for a partial response', async () => {
    prisma.profilProfessionnel.findUnique.mockResolvedValue({
      id: pharmacyId,
      estPharmacie: true,
      statutKyc: StatutKyc.VERIFIE,
    });
    prisma.commandePharmacie.findFirst.mockResolvedValue(baseOrder);

    await expect(
      service.validate(pharmacyUser, baseOrder.id, {
        status: 'PARTIELLEMENT_DISPONIBLE',
        medicineItems: [
          { position: 0, name: 'Consultation', isAvailable: true, price: 5000 },
          { position: 1, name: 'Paracetamol', isAvailable: true, price: 7500 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.commandePharmacie.updateMany).not.toHaveBeenCalled();
  });

  it('stores each medicine state and totals only available medicines for a partial response', async () => {
    const medicineItems = [
      { position: 0, name: 'Consultation', isAvailable: true, price: 5000 },
      { position: 1, name: 'Paracetamol', isAvailable: false, price: null },
    ];
    const validatedOrder = {
      ...baseOrder,
      statut: StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE,
      montantMedicaments: 5000,
      detailsMedicaments: medicineItems,
      indisponibilites: ['Paracetamol'],
      valideePharmacieLe: new Date(),
    };
    prisma.profilProfessionnel.findUnique.mockResolvedValue({
      id: pharmacyId,
      estPharmacie: true,
      statutKyc: StatutKyc.VERIFIE,
    });
    prisma.commandePharmacie.findFirst
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce(validatedOrder);
    prisma.commandePharmacie.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.validate(pharmacyUser, baseOrder.id, {
      status: 'PARTIELLEMENT_DISPONIBLE',
      medicineItems,
    });

    expect(prisma.commandePharmacie.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          montantMedicaments: 5000,
          indisponibilites: ['Paracetamol'],
          detailsMedicaments: medicineItems,
        }),
      }),
    );
    expect(result.medicineAmount).toBe(5000);
    expect(result.medicineItems).toEqual(medicineItems);
  });

  it('prevents two concurrent decisions for the same order', async () => {
    prisma.profilProfessionnel.findUnique.mockResolvedValue({
      id: pharmacyId,
      estPharmacie: true,
      statutKyc: StatutKyc.VERIFIE,
    });
    prisma.commandePharmacie.findFirst.mockResolvedValue(baseOrder);
    prisma.commandePharmacie.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.validate(pharmacyUser, baseOrder.id, {
        status: 'EN_ATTENTE_PAIEMENT',
        medicineItems: [
          { position: 0, name: 'Consultation', isAvailable: true, price: 5000 },
          { position: 1, name: 'Paracetamol', isAvailable: true, price: 7500 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.createInAppNotification).not.toHaveBeenCalled();
  });
});
