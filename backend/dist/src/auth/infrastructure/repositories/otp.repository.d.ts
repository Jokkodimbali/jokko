import { PrismaService } from '../../../prisma/prisma.service';
export declare class OtpRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByPhoneNumber(phoneNumber: string): import("@prisma/client").Prisma.Prisma__VerificationOtpClient<{
        id: string;
        numeroTelephone: string;
        creeLe: Date;
        misAJourLe: Date;
        hashCode: string;
        expireLe: Date;
        tentatives: number;
        dernierEnvoiLe: Date;
        consommeLe: Date | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    upsertForPhoneNumber(data: {
        phoneNumber: string;
        codeHash: string;
        expiresAt: Date;
        lastSentAt: Date;
    }): import("@prisma/client").Prisma.Prisma__VerificationOtpClient<{
        id: string;
        numeroTelephone: string;
        creeLe: Date;
        misAJourLe: Date;
        hashCode: string;
        expireLe: Date;
        tentatives: number;
        dernierEnvoiLe: Date;
        consommeLe: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    incrementAttempts(id: string): import("@prisma/client").Prisma.Prisma__VerificationOtpClient<{
        id: string;
        numeroTelephone: string;
        creeLe: Date;
        misAJourLe: Date;
        hashCode: string;
        expireLe: Date;
        tentatives: number;
        dernierEnvoiLe: Date;
        consommeLe: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    consume(id: string): import("@prisma/client").Prisma.Prisma__VerificationOtpClient<{
        id: string;
        numeroTelephone: string;
        creeLe: Date;
        misAJourLe: Date;
        hashCode: string;
        expireLe: Date;
        tentatives: number;
        dernierEnvoiLe: Date;
        consommeLe: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    delete(id: string): import("@prisma/client").Prisma.Prisma__VerificationOtpClient<{
        id: string;
        numeroTelephone: string;
        creeLe: Date;
        misAJourLe: Date;
        hashCode: string;
        expireLe: Date;
        tentatives: number;
        dernierEnvoiLe: Date;
        consommeLe: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
