import { Injectable } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';

type UpdateMyMedicalProfileInput = {
  bloodGroup?: string | null;
  rhesus?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  referenceDoctorName?: string | null;
  profession?: string | null;
  allergies?: string[];
  conditions?: string[];
};

type UpsertMyMedicalTreatmentInput = {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  notes?: string | null;
};

type MedicalTreatmentRow = {
  id: string;
  nom: string;
  dosage: string | null;
  frequence: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  notes: string | null;
  creeLe: Date;
  misAJourLe: Date;
};

type MedicalProfileRow = {
  id: string;
  groupeSanguin: string | null;
  rhesus: string | null;
  poidsKg: Prisma.Decimal | null;
  tailleCm: number | null;
  medecinReferent: string | null;
  profession: string | null;
  allergies: string[];
  antecedents: string[];
  creeLe: Date;
  misAJourLe: Date;
  traitements: MedicalTreatmentRow[];
};

export type MedicalTreatmentView = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startedAt: string | null;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MedicalProfileView = {
  id: string | null;
  bloodGroup: string | null;
  rhesus: string | null;
  weightKg: number | null;
  heightCm: number | null;
  referenceDoctorName: string | null;
  profession: string | null;
  allergies: string[];
  conditions: string[];
  bmi: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  treatments: MedicalTreatmentView[];
};

@Injectable()
export class UsersMedicalProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyMedicalProfile(userId: string): Promise<MedicalProfileView> {
    const profile = await this.findProfile(userId);
    return profile ? this.toProfileView(profile) : this.emptyProfile();
  }

  async getPatientMedicalProfileForProfessional(
    requester: { sub: string; role: RoleUtilisateur },
    clientId: string,
  ): Promise<MedicalProfileView> {
    if (
      requester.role !== RoleUtilisateur.PRESTATAIRE &&
      requester.role !== RoleUtilisateur.MEDECIN &&
      requester.role !== RoleUtilisateur.ADMIN
    ) {
      throw appHttpException('USERS_MEDICAL_PROFILE_ACCESS_FORBIDDEN');
    }

    if (requester.role !== RoleUtilisateur.ADMIN) {
      const professionalProfile =
        await this.prisma.profilProfessionnel.findUnique({
          where: { utilisateurId: requester.sub },
          select: { id: true },
        });

      if (!professionalProfile) {
        throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
      }

      const sharedReservation = await this.prisma.reservation.findFirst({
        where: {
          clientId,
          professionnelId: professionalProfile.id,
        },
        select: { id: true },
      });

      if (!sharedReservation) {
        throw appHttpException('USERS_MEDICAL_PROFILE_ACCESS_FORBIDDEN');
      }
    }

    const profile = await this.findProfile(clientId);
    return profile ? this.toProfileView(profile) : this.emptyProfile();
  }

  async updateMyMedicalProfile(
    userId: string,
    dto: UpdateMyMedicalProfileInput,
  ): Promise<MedicalProfileView> {
    const profile = await this.prisma.ficheMedicaleClient.upsert({
      where: { utilisateurId: userId },
      create: {
        utilisateurId: userId,
        groupeSanguin: dto.bloodGroup ?? null,
        rhesus: dto.rhesus ?? null,
        poidsKg: this.decimalOrNull(dto.weightKg),
        tailleCm: dto.heightCm ?? null,
        medecinReferent: dto.referenceDoctorName ?? null,
        profession: dto.profession ?? null,
        allergies: dto.allergies ?? [],
        antecedents: dto.conditions ?? [],
      },
      update: {
        groupeSanguin: dto.bloodGroup ?? null,
        rhesus: dto.rhesus ?? null,
        poidsKg: this.decimalOrNull(dto.weightKg),
        tailleCm: dto.heightCm ?? null,
        medecinReferent: dto.referenceDoctorName ?? null,
        profession: dto.profession ?? null,
        allergies: dto.allergies ?? [],
        antecedents: dto.conditions ?? [],
      },
      include: this.profileInclude(),
    });

    return this.toProfileView(profile);
  }

  async createTreatment(
    userId: string,
    dto: UpsertMyMedicalTreatmentInput,
  ): Promise<MedicalProfileView> {
    const profile = await this.ensureProfile(userId);
    await this.prisma.traitementMedicalClient.create({
      data: this.toTreatmentData(profile.id, dto),
    });

    return this.getMyMedicalProfile(userId);
  }

  async updateTreatment(
    userId: string,
    treatmentId: string,
    dto: UpsertMyMedicalTreatmentInput,
  ): Promise<MedicalProfileView> {
    const treatment = await this.findTreatmentForUser(userId, treatmentId);
    if (!treatment) {
      throw appHttpException('USERS_MEDICAL_TREATMENT_NOT_FOUND');
    }

    await this.prisma.traitementMedicalClient.update({
      where: { id: treatment.id },
      data: this.toTreatmentUpdate(dto),
    });

    return this.getMyMedicalProfile(userId);
  }

  async deleteTreatment(
    userId: string,
    treatmentId: string,
  ): Promise<MedicalProfileView> {
    const treatment = await this.findTreatmentForUser(userId, treatmentId);
    if (!treatment) {
      throw appHttpException('USERS_MEDICAL_TREATMENT_NOT_FOUND');
    }

    await this.prisma.traitementMedicalClient.delete({
      where: { id: treatment.id },
    });

    return this.getMyMedicalProfile(userId);
  }

  private async findProfile(userId: string): Promise<MedicalProfileRow | null> {
    return this.prisma.ficheMedicaleClient.findUnique({
      where: { utilisateurId: userId },
      include: this.profileInclude(),
    });
  }

  private async ensureProfile(userId: string): Promise<{ id: string }> {
    return this.prisma.ficheMedicaleClient.upsert({
      where: { utilisateurId: userId },
      create: { utilisateurId: userId },
      update: {},
      select: { id: true },
    });
  }

  private async findTreatmentForUser(
    userId: string,
    treatmentId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.traitementMedicalClient.findFirst({
      where: {
        id: treatmentId,
        ficheMedicale: {
          utilisateurId: userId,
        },
      },
      select: { id: true },
    });
  }

  private profileInclude() {
    return {
      traitements: {
        orderBy: [{ dateDebut: 'desc' as const }, { creeLe: 'desc' as const }],
      },
    };
  }

  private toTreatmentData(
    profileId: string,
    dto: UpsertMyMedicalTreatmentInput,
  ): Prisma.TraitementMedicalClientCreateInput {
    return {
      ficheMedicale: { connect: { id: profileId } },
      nom: dto.name,
      dosage: dto.dosage ?? null,
      frequence: dto.frequency ?? null,
      dateDebut: this.dateOrNull(dto.startedAt),
      dateFin: this.dateOrNull(dto.endedAt),
      notes: dto.notes ?? null,
    };
  }

  private toTreatmentUpdate(
    dto: UpsertMyMedicalTreatmentInput,
  ): Prisma.TraitementMedicalClientUpdateInput {
    return {
      nom: dto.name,
      dosage: dto.dosage ?? null,
      frequence: dto.frequency ?? null,
      dateDebut: this.dateOrNull(dto.startedAt),
      dateFin: this.dateOrNull(dto.endedAt),
      notes: dto.notes ?? null,
    };
  }

  private toProfileView(profile: MedicalProfileRow): MedicalProfileView {
    const weightKg = profile.poidsKg
      ? Number(profile.poidsKg.toString())
      : null;
    return {
      id: profile.id,
      bloodGroup: profile.groupeSanguin,
      rhesus: profile.rhesus,
      weightKg,
      heightCm: profile.tailleCm,
      referenceDoctorName: profile.medecinReferent,
      profession: profile.profession,
      allergies: profile.allergies,
      conditions: profile.antecedents,
      bmi: this.calculateBmi(weightKg, profile.tailleCm),
      createdAt: profile.creeLe.toISOString(),
      updatedAt: profile.misAJourLe.toISOString(),
      treatments: profile.traitements.map((treatment) =>
        this.toTreatmentView(treatment),
      ),
    };
  }

  private toTreatmentView(
    treatment: MedicalTreatmentRow,
  ): MedicalTreatmentView {
    return {
      id: treatment.id,
      name: treatment.nom,
      dosage: treatment.dosage,
      frequency: treatment.frequence,
      startedAt: treatment.dateDebut?.toISOString().slice(0, 10) ?? null,
      endedAt: treatment.dateFin?.toISOString().slice(0, 10) ?? null,
      notes: treatment.notes,
      createdAt: treatment.creeLe.toISOString(),
      updatedAt: treatment.misAJourLe.toISOString(),
    };
  }

  private emptyProfile(): MedicalProfileView {
    return {
      id: null,
      bloodGroup: null,
      rhesus: null,
      weightKg: null,
      heightCm: null,
      referenceDoctorName: null,
      profession: null,
      allergies: [],
      conditions: [],
      bmi: null,
      createdAt: null,
      updatedAt: null,
      treatments: [],
    };
  }

  private calculateBmi(
    weightKg: number | null,
    heightCm: number | null,
  ): number | null {
    if (!weightKg || !heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  }

  private decimalOrNull(
    value: number | null | undefined,
  ): Prisma.Decimal | null {
    return value === null || value === undefined
      ? null
      : new Prisma.Decimal(value);
  }

  private dateOrNull(value: string | null | undefined): Date | null {
    return value ? new Date(value) : null;
  }
}
