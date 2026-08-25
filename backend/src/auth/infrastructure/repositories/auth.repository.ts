import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthRepositoryPort } from '../../application/ports/auth-repository.port';

@Injectable()
export class AuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findByPhoneNumber(phoneNumber: string) {
    return this.prisma.utilisateur.findUnique({
      where: { numeroTelephone: phoneNumber },
    });
  }

  findById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        estActif: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        email: true,
        urlAvatar: true,
        identifiantOauth: true,
        estActif: true,
      },
    });
  }

  findByGoogleIdentity(googleSub: string) {
    return this.prisma.utilisateur.findFirst({
      where: {
        fournisseurOauth: 'google',
        identifiantOauth: googleSub,
      },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        email: true,
        urlAvatar: true,
        identifiantOauth: true,
        estActif: true,
      },
    });
  }

  findWithPasswordByPhoneNumber(phoneNumber: string) {
    return this.prisma.utilisateur.findUnique({
      where: { numeroTelephone: phoneNumber },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        motDePasseHash: true,
        estActif: true,
      },
    });
  }

  async createClientByPhoneNumber(phoneNumber: string) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          numeroTelephone: phoneNumber,
          nom: `Utilisateur ${phoneNumber}`,
          role: RoleUtilisateur.CLIENT,
          estActif: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createClientWithPassword(data: {
    phoneNumber: string;
    name: string;
    email?: string;
    passwordHash: string;
    role: RoleUtilisateur;
    adresse: string;
    medicalSpecialty?: string;
    medicalExpertises?: string[];
    medicalDocumentNames?: string[];
    categoryIds?: string[];
    subCategoryIds?: string[];
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.utilisateur.create({
          data: {
            numeroTelephone: data.phoneNumber,
            nom: data.name,
            email: data.email,
            motDePasseHash: data.passwordHash,
            role: data.role,
            adresse: data.adresse,
            estActif: true,
          },
        });

        if (
          data.role === RoleUtilisateur.PRESTATAIRE ||
          data.role === RoleUtilisateur.MEDECIN
        ) {
          const professionalProfile = await tx.profilProfessionnel.create({
            data: {
              utilisateurId: user.id,
              nomEntreprise: data.name,
              ville: this.extractCity(data.adresse),
              biographie: this.buildProfessionalBiography(data),
              statutKyc: 'EN_ATTENTE',
            },
          });

          await this.createProfessionalSpecialties(tx, {
            professionalProfileId: professionalProfile.id,
            role: data.role,
            categoryIds: data.categoryIds,
            subCategoryIds: data.subCategoryIds,
          });
        }

        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createGoogleClient(data: {
    email: string;
    name: string;
    googleSub: string;
    avatarUrl?: string | null;
  }) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          numeroTelephone: this.googlePhoneNumber(data.googleSub),
          nom: data.name,
          email: data.email,
          role: RoleUtilisateur.CLIENT,
          urlAvatar: data.avatarUrl,
          fournisseurOauth: 'google',
          identifiantOauth: data.googleSub,
          estActif: true,
        },
        select: {
          id: true,
          numeroTelephone: true,
          nom: true,
          role: true,
          email: true,
          urlAvatar: true,
          identifiantOauth: true,
          estActif: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  findPublicProfileById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        email: true,
        role: true,
        urlAvatar: true,
        estActif: true,
      },
    });
  }

  createRefreshSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: { platform?: string; userAgent?: string },
  ) {
    return this.prisma.sessionAuthentification.create({
      data: {
        utilisateurId: userId,
        hashJeton: tokenHash,
        expireLe: expiresAt,
        plateforme: metadata?.platform,
        userAgent: metadata?.userAgent,
      },
    });
  }

  findWithPasswordByEmail(email: string) {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        motDePasseHash: true,
        estActif: true,
      },
    });
  }

  findActiveSessionByTokenHash(tokenHash: string) {
    return this.prisma.sessionAuthentification.findFirst({
      where: {
        hashJeton: tokenHash,
        revoqueLe: null,
      },
    });
  }

  revokeSessionById(sessionId: string) {
    return this.prisma.sessionAuthentification.update({
      where: { id: sessionId },
      data: { revoqueLe: new Date() },
    });
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    await this.prisma.sessionAuthentification.updateMany({
      where: { hashJeton: tokenHash, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }

  rotateSessionToken(
    oldSessionId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
    metadata?: { platform?: string; userAgent?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.sessionAuthentification.update({
        where: { id: oldSessionId },
        data: { revoqueLe: new Date() },
      });
      await tx.sessionAuthentification.create({
        data: {
          utilisateurId: userId,
          hashJeton: newTokenHash,
          expireLe: expiresAt,
          plateforme: metadata?.platform,
          userAgent: metadata?.userAgent,
        },
      });
    });
  }

  linkGoogleIdentity(userId: string, googleSub: string) {
    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        fournisseurOauth: 'google',
        identifiantOauth: googleSub,
      },
    });
  }

  private googlePhoneNumber(googleSub: string): string {
    const digest = createHash('sha256').update(googleSub).digest('hex');
    return `google-${digest.slice(0, 12)}`;
  }

  private extractCity(address: string): string | undefined {
    const city = address.split(',')[0]?.trim();
    return city || undefined;
  }

  private buildProfessionalBiography(data: {
    role: RoleUtilisateur;
    medicalSpecialty?: string;
    medicalExpertises?: string[];
    medicalDocumentNames?: string[];
  }): string | undefined {
    if (data.role !== RoleUtilisateur.MEDECIN) {
      return undefined;
    }

    const sections = [
      data.medicalSpecialty ? `Specialite: ${data.medicalSpecialty}` : null,
      data.medicalExpertises?.length
        ? `Expertises: ${data.medicalExpertises.join(', ')}`
        : null,
      data.medicalDocumentNames?.length
        ? `Documents: ${data.medicalDocumentNames.join(', ')}`
        : null,
    ].filter(Boolean);

    return sections.length
      ? sections.join('\n')
      : 'Profil medecin en attente de verification.';
  }

  private async createProfessionalSpecialties(
    tx: Prisma.TransactionClient,
    data: {
      professionalProfileId: string;
      role: RoleUtilisateur;
      categoryIds?: string[];
      subCategoryIds?: string[];
    },
  ): Promise<void> {
    const categoryIds = this.uniqueIds(data.categoryIds);
    const subCategoryIds = this.uniqueIds(data.subCategoryIds);

    if (categoryIds.length === 0) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const categories = await tx.categorie.findMany({
      where: { id: { in: categoryIds }, estActive: true },
      select: {
        id: true,
        nom: true,
        sousCategories: {
          where: { sousCategorie: { estActive: true } },
          select: {
            sousCategorieId: true,
            sousCategorie: { select: { id: true } },
          },
        },
      },
    });

    if (categories.length !== categoryIds.length) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    if (
      data.role === RoleUtilisateur.MEDECIN &&
      categories.some((category) => !this.isMedicalCategoryName(category.nom))
    ) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const subCategoryToCategory = new Map<string, string>();
    categories.forEach((category) => {
      category.sousCategories.forEach((assignment) => {
        subCategoryToCategory.set(assignment.sousCategorie.id, category.id);
      });
    });

    if (
      subCategoryIds.some(
        (subCategoryId) => !subCategoryToCategory.has(subCategoryId),
      )
    ) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const subCategoriesByCategory = new Map<string, string[]>();
    subCategoryIds.forEach((subCategoryId) => {
      const categoryId = subCategoryToCategory.get(subCategoryId);
      if (!categoryId) return;
      const current = subCategoriesByCategory.get(categoryId) ?? [];
      current.push(subCategoryId);
      subCategoriesByCategory.set(categoryId, current);
    });

    const specialties: Array<{
      categorieId: string;
      sousCategorieId: string | null;
    }> = [];

    categoryIds.forEach((categoryId) => {
      const selectedSubCategories =
        subCategoriesByCategory.get(categoryId) ?? [];
      if (selectedSubCategories.length === 0) {
        specialties.push({ categorieId: categoryId, sousCategorieId: null });
        return;
      }

      selectedSubCategories.forEach((subCategoryId) =>
        specialties.push({
          categorieId: categoryId,
          sousCategorieId: subCategoryId,
        }),
      );
    });

    await tx.specialiteProfessionnelle.createMany({
      data: specialties.map((specialty) => ({
        profilProfessionnelId: data.professionalProfileId,
        categorieId: specialty.categorieId,
        sousCategorieId: specialty.sousCategorieId,
      })),
      skipDuplicates: true,
    });

    const selectedSubCategoryNames = subCategoryIds.length
      ? await tx.sousCategorieService.findMany({
          where: { id: { in: subCategoryIds }, estActive: true },
          select: { id: true, nom: true },
        })
      : [];
    const subCategoryNameById = new Map(
      selectedSubCategoryNames.map((subCategory) => [
        subCategory.id,
        subCategory.nom,
      ]),
    );

    if (
      data.role === RoleUtilisateur.PRESTATAIRE &&
      selectedSubCategoryNames.some((subCategory) =>
        this.isPharmacySubCategoryName(subCategory.nom),
      )
    ) {
      await tx.profilProfessionnel.update({
        where: { id: data.professionalProfileId },
        data: { estPharmacie: true },
      });
    }

    await tx.service.createMany({
      data: categories.map((category) => {
        const specialtyNames = (subCategoriesByCategory.get(category.id) ?? [])
          .map((subCategoryId) => subCategoryNameById.get(subCategoryId))
          .filter((name): name is string => Boolean(name));

        return {
          profilProfessionnelId: data.professionalProfileId,
          categorieId: category.id,
          nom: category.nom,
          description: specialtyNames.length
            ? `Service ${category.nom}. Specialites: ${specialtyNames.join(', ')}.`
            : `Service ${category.nom}.`,
          prix: 0,
          typePrix:
            data.role === RoleUtilisateur.MEDECIN ? 'FIXE' : 'NEGOCIABLE',
          dureeMinutes: 30,
          estObligatoire: false,
          estDisponible: true,
        };
      }),
    });
  }

  private uniqueIds(ids?: string[]): string[] {
    return Array.from(
      new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)),
    );
  }

  private isPharmacySubCategoryName(name: string): boolean {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return /\bpharmaci(?:en|e)\b/.test(normalized);
  }

  private isMedicalCategoryName(name: string): boolean {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return [
      'medec',
      'medical',
      'sante',
      'soin',
      'clinique',
      'hopital',
      'pharma',
      'dent',
      'chirurg',
      'gyneco',
      'pediatr',
      'cardio',
      'doct',
      'infirm',
      'cabinet',
    ].some((keyword) => normalized.includes(keyword));
  }
}
