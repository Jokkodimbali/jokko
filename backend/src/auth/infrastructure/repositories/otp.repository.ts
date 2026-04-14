import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  type OtpRepositoryPort,
  type OtpVerificationEntry,
} from '../../application/ports/otp-repository.port';

@Injectable()
export class OtpRepository implements OtpRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhoneNumber(
    phoneNumber: string,
  ): Promise<OtpVerificationEntry | null> {
    const entity = await this.prisma.verificationOtp.findUnique({
      where: { numeroTelephone: phoneNumber },
    });
    if (!entity) {
      return null;
    }

    return {
      id: entity.id,
      phoneNumber: entity.numeroTelephone,
      codeHash: entity.hashCode,
      expiresAt: entity.expireLe,
      consumedAt: entity.consommeLe,
      attempts: entity.tentatives,
      lastSentAt: entity.dernierEnvoiLe,
    };
  }

  async upsertForPhoneNumber(data: {
    phoneNumber: string;
    codeHash: string;
    expiresAt: Date;
    lastSentAt: Date;
  }): Promise<void> {
    await this.prisma.verificationOtp.upsert({
      where: { numeroTelephone: data.phoneNumber },
      create: {
        numeroTelephone: data.phoneNumber,
        hashCode: data.codeHash,
        expireLe: data.expiresAt,
        dernierEnvoiLe: data.lastSentAt,
      },
      update: {
        hashCode: data.codeHash,
        expireLe: data.expiresAt,
        dernierEnvoiLe: data.lastSentAt,
        tentatives: 0,
        consommeLe: null,
      },
    });
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.prisma.verificationOtp.update({
      where: { id },
      data: {
        tentatives: { increment: 1 },
      },
    });
  }

  async consume(id: string): Promise<void> {
    await this.prisma.verificationOtp.update({
      where: { id },
      data: { consommeLe: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.verificationOtp.delete({
      where: { id },
    });
  }
}
