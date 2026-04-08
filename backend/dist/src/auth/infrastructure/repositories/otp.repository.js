"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let OtpRepository = class OtpRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByPhoneNumber(phoneNumber) {
        return this.prisma.verificationOtp.findUnique({
            where: { numeroTelephone: phoneNumber },
        });
    }
    upsertForPhoneNumber(data) {
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
    incrementAttempts(id) {
        return this.prisma.verificationOtp.update({
            where: { id },
            data: {
                tentatives: { increment: 1 },
            },
        });
    }
    consume(id) {
        return this.prisma.verificationOtp.update({
            where: { id },
            data: { consommeLe: new Date() },
        });
    }
    delete(id) {
        return this.prisma.verificationOtp.delete({
            where: { id },
        });
    }
};
exports.OtpRepository = OtpRepository;
exports.OtpRepository = OtpRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OtpRepository);
//# sourceMappingURL=otp.repository.js.map