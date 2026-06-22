import { Injectable } from '@nestjs/common';
import { RoleUtilisateur, StatutDiplomeMedical } from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminMedicalCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPending(requestUser: AuthUser) {
    this.assertAdmin(requestUser);

    const profiles = await this.prisma.profilProfessionnel.findMany({
      where: {
        diplomesMedicaux: { some: { statut: StatutDiplomeMedical.EN_ATTENTE } },
      },
      orderBy: { creeLe: 'desc' },
      select: {
        id: true,
        biographie: true,
        nomEntreprise: true,
        ville: true,
        statutKyc: true,
        creeLe: true,
        utilisateur: {
          select: {
            nom: true,
            numeroTelephone: true,
            urlAvatar: true,
          },
        },
        services: {
          where: { estDisponible: true },
          orderBy: { creeLe: 'desc' },
          take: 4,
          select: {
            nom: true,
            description: true,
            dureeMinutes: true,
            categorie: { select: { nom: true } },
          },
        },
        diplomesMedicaux: {
          orderBy: { creeLe: 'desc' },
          select: {
            id: true,
            titre: true,
            etablissement: true,
            promotion: true,
            numeroReference: true,
            urlDocument: true,
            statut: true,
            noteVerification: true,
            verifieLe: true,
            creeLe: true,
          },
        },
      },
    });

    return profiles.map((profile) => this.toMedicalCredentialProfile(profile));
  }

  async certify(requestUser: AuthUser, professionalId: string) {
    this.assertAdmin(requestUser);

    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { id: professionalId },
      select: { id: true },
    });
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    await this.prisma.$transaction([
      this.prisma.diplomeMedical.updateMany({
        where: {
          profilProfessionnelId: professionalId,
          statut: StatutDiplomeMedical.EN_ATTENTE,
        },
        data: {
          statut: StatutDiplomeMedical.AUTHENTIFIE,
          verifieLe: new Date(),
          noteVerification: null,
        },
      }),
      this.prisma.profilProfessionnel.update({
        where: { id: professionalId },
        data: { statutKyc: 'VERIFIE', raisonRejetKyc: null },
      }),
    ]);

    return { professionalId, status: StatutDiplomeMedical.AUTHENTIFIE };
  }

  async reject(requestUser: AuthUser, professionalId: string, reason: string) {
    this.assertAdmin(requestUser);

    const cleanReason = reason.trim();
    if (cleanReason.length < 10) {
      throw appHttpException('PROFESSIONALS_REJECT_REASON_EMPTY');
    }

    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { id: professionalId },
      select: { id: true },
    });
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    await this.prisma.$transaction([
      this.prisma.diplomeMedical.updateMany({
        where: {
          profilProfessionnelId: professionalId,
          statut: StatutDiplomeMedical.EN_ATTENTE,
        },
        data: {
          statut: StatutDiplomeMedical.REJETE,
          noteVerification: cleanReason,
          verifieLe: new Date(),
        },
      }),
      this.prisma.profilProfessionnel.update({
        where: { id: professionalId },
        data: { statutKyc: 'REJETE', raisonRejetKyc: cleanReason },
      }),
    ]);

    return { professionalId, status: StatutDiplomeMedical.REJETE };
  }

  private assertAdmin(requestUser: AuthUser) {
    if (requestUser.role !== RoleUtilisateur.ADMIN) {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }
  }

  private toMedicalCredentialProfile(profile: {
    id: string;
    biographie: string | null;
    nomEntreprise: string | null;
    ville: string | null;
    statutKyc: string;
    creeLe: Date;
    utilisateur: {
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
    services: Array<{
      nom: string;
      description: string;
      dureeMinutes: number;
      categorie: { nom: string };
    }>;
    diplomesMedicaux: Array<{
      id: string;
      titre: string;
      etablissement: string;
      promotion: string | null;
      numeroReference: string | null;
      urlDocument: string | null;
      statut: string;
      noteVerification: string | null;
      verifieLe: Date | null;
      creeLe: Date;
    }>;
  }) {
    const primaryService = profile.services[0] ?? null;

    return {
      id: profile.id,
      name: profile.nomEntreprise ?? profile.utilisateur.nom,
      practitionerName: profile.utilisateur.nom,
      specialty: primaryService?.categorie.nom ?? primaryService?.nom ?? null,
      city: profile.ville,
      phone: profile.utilisateur.numeroTelephone,
      avatarUrl: profile.utilisateur.urlAvatar,
      submittedAt: profile.creeLe,
      kycStatus: profile.statutKyc,
      biography: profile.biographie,
      council: this.buildCouncilLine(profile.diplomesMedicaux),
      diplomas: profile.diplomesMedicaux.map((diploma) => ({
        id: diploma.id,
        title: diploma.titre,
        institution: diploma.etablissement,
        graduationYear: diploma.promotion,
        referenceNumber: diploma.numeroReference,
        documentUrl: diploma.urlDocument,
        status: diploma.statut,
        verificationNote: diploma.noteVerification,
        verifiedAt: diploma.verifieLe,
      })),
      declaredServices: profile.services.map((service) => ({
        label: service.nom,
        category: service.categorie.nom,
        description: service.description,
        durationMinutes: service.dureeMinutes,
      })),
    };
  }

  private buildCouncilLine(
    diplomas: Array<{ numeroReference: string | null }>,
  ): string | null {
    const reference = diplomas.find(
      (diploma) => diploma.numeroReference,
    )?.numeroReference;
    return reference ? `Conseil de l'ordre - ${reference}` : null;
  }
}
