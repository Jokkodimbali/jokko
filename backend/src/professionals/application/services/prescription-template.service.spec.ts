import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { PrescriptionTemplateService } from './prescription-template.service';
import type { PrismaService } from '../../../prisma/prisma.service';

describe('PrescriptionTemplateService', () => {
  const profile = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const service = new PrescriptionTemplateService({
    profilProfessionnel: profile,
  } as unknown as PrismaService);
  const doctor = {
    sub: 'doctor-id',
    role: RoleUtilisateur.MEDECIN,
    phoneNumber: '',
  };
  const provider = { ...doctor, role: RoleUtilisateur.PRESTATAIRE };

  beforeEach(() => jest.clearAllMocks());

  it('rejects non-doctors', async () => {
    await expect(service.getMine(provider)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(profile.findUnique).not.toHaveBeenCalled();
  });

  it('loads the saved model for the doctor', async () => {
    profile.findUnique.mockResolvedValue({
      modeleOrdonnance: { structure: 'Cabinet A' },
    });
    await expect(service.getMine(doctor)).resolves.toEqual({
      structure: 'Cabinet A',
    });
  });

  it('saves sanitized fields on the doctor profile', async () => {
    profile.update.mockResolvedValue({
      modeleOrdonnance: { structure: 'Cabinet A' },
    });
    await service.updateMine(doctor, { structure: ' Cabinet A ' });
    expect(profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { utilisateurId: doctor.sub },
        data: {
          modeleOrdonnance: expect.objectContaining({ structure: 'Cabinet A' }),
        },
      }),
    );
  });

  it('rejects external signature URLs', async () => {
    await expect(
      service.updateMine(doctor, {
        signatureUrl: 'https://example.com/signature.png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(profile.update).not.toHaveBeenCalled();
  });
});
