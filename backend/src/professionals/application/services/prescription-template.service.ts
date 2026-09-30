import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdatePrescriptionTemplateDto } from '../../presentation/dto/update-prescription-template.dto';

@Injectable()
export class PrescriptionTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(user: AuthUser) {
    this.assertDoctor(user);
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: user.sub },
      select: { modeleOrdonnance: true },
    });
    if (!profile)
      throw new NotFoundException('Profil professionnel introuvable.');
    return profile.modeleOrdonnance ?? null;
  }

  async updateMine(user: AuthUser, input: UpdatePrescriptionTemplateDto) {
    this.assertDoctor(user);
    for (const url of [input.logoUrl, input.signatureUrl, input.cachetUrl]) {
      if (!url) continue;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestException('URL d image invalide.');
      }
      if (
        parsed.protocol !== 'https:' ||
        parsed.hostname !== 'res.cloudinary.com' ||
        !parsed.pathname.includes('/image/upload/') ||
        !parsed.pathname.includes('/jokko/professionals/')
      ) {
        throw new BadRequestException(
          'Utilisez une image importée dans votre espace professionnel.',
        );
      }
    }
    const template = {
      tutelle: input.tutelle?.trim() ?? '',
      region: input.region?.trim() ?? '',
      structure: input.structure?.trim() ?? '',
      prescripteur: input.prescripteur?.trim() ?? '',
      qualification: input.qualification?.trim() ?? '',
      adresse: input.adresse?.trim() ?? '',
      telephone: input.telephone?.trim() ?? '',
      piedDePage: input.piedDePage?.trim() ?? '',
      logoUrl: input.logoUrl?.trim() ?? '',
      signatureUrl: input.signatureUrl?.trim() ?? '',
      cachetUrl: input.cachetUrl?.trim() ?? '',
    };
    const profile = await this.prisma.profilProfessionnel
      .update({
        where: { utilisateurId: user.sub },
        data: { modeleOrdonnance: template as Prisma.InputJsonValue },
        select: { modeleOrdonnance: true },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException('Profil professionnel introuvable.');
        }
        throw error;
      });
    return profile.modeleOrdonnance;
  }

  private assertDoctor(user: AuthUser): void {
    if (user.role !== RoleUtilisateur.MEDECIN) {
      throw new ForbiddenException(
        'Seul un médecin peut personnaliser une ordonnance.',
      );
    }
  }
}
