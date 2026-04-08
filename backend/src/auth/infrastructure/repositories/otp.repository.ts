import { Injectable } from '@nestjs/common';
// Prisma model: VerificationOtp

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPhoneNumber(phoneNumber: string) {
    return this.prisma.verificationOtp.findUnique({
      where: { numeroTelephone: phoneNumber },
    });
  }

  upsertForPhoneNumber(data: {
    phoneNumber: string;
    codeHash: string;
    expiresAt: Date;
    lastSentAt: Date;
  }) {
    return this.prisma.verificationOtp.upsert({
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

  incrementAttempts(id: string) {
    return this.prisma.verificationOtp.update({
      where: { id },
      data: {
        tentatives: { increment: 1 },
      },
    });
  }

  consume(id: string) {
    return this.prisma.verificationOtp.update({
      where: { id },
      data: { consommeLe: new Date() },
    });
  }

  delete(id: string) {
    return this.prisma.verificationOtp.delete({
      where: { id },
    });
  }
}
