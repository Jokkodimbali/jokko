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
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../prisma/prisma.service");
let AuthRepository = class AuthRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findByPhoneNumber(phoneNumber) {
        return this.prisma.utilisateur.findUnique({
            where: { numeroTelephone: phoneNumber },
        });
    }
    findById(userId) {
        return this.prisma.utilisateur.findUnique({
            where: { id: userId },
            select: {
                id: true,
                numeroTelephone: true,
                nom: true,
                role: true,
            },
        });
    }
    findByEmail(email) {
        return this.prisma.utilisateur.findUnique({
            where: { email },
            select: {
                id: true,
                numeroTelephone: true,
                nom: true,
                role: true,
                email: true,
                identifiantOauth: true,
            },
        });
    }
    findWithPasswordByPhoneNumber(phoneNumber) {
        return this.prisma.utilisateur.findUnique({
            where: { numeroTelephone: phoneNumber },
            select: {
                id: true,
                numeroTelephone: true,
                nom: true,
                role: true,
                motDePasseHash: true,
            },
        });
    }
    createClientByPhoneNumber(phoneNumber) {
        return this.prisma.utilisateur.create({
            data: {
                numeroTelephone: phoneNumber,
                nom: `Utilisateur ${phoneNumber}`,
                role: client_1.RoleUtilisateur.CLIENT,
            },
        });
    }
    createClientWithPassword(data) {
        return this.prisma.utilisateur.create({
            data: {
                numeroTelephone: data.phoneNumber,
                nom: data.name,
                email: data.email,
                motDePasseHash: data.passwordHash,
                role: client_1.RoleUtilisateur.CLIENT,
            },
        });
    }
    findPublicProfileById(userId) {
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
    createRefreshSession(userId, tokenHash, expiresAt) {
        return this.prisma.sessionAuthentification.create({
            data: {
                utilisateurId: userId,
                hashJeton: tokenHash,
                expireLe: expiresAt,
            },
        });
    }
    findActiveSessionByTokenHash(tokenHash) {
        return this.prisma.sessionAuthentification.findFirst({
            where: {
                hashJeton: tokenHash,
                revoqueLe: null,
            },
        });
    }
    revokeSessionById(sessionId) {
        return this.prisma.sessionAuthentification.update({
            where: { id: sessionId },
            data: { revoqueLe: new Date() },
        });
    }
    async revokeSessionByTokenHash(tokenHash) {
        await this.prisma.sessionAuthentification.updateMany({
            where: { hashJeton: tokenHash, revoqueLe: null },
            data: { revoqueLe: new Date() },
        });
    }
    rotateSessionToken(oldSessionId, userId, newTokenHash, expiresAt) {
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
                },
            });
        });
    }
    linkGoogleIdentity(userId, googleSub) {
        return this.prisma.utilisateur.update({
            where: { id: userId },
            data: {
                fournisseurOauth: 'google',
                identifiantOauth: googleSub,
            },
        });
    }
};
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthRepository);
//# sourceMappingURL=auth.repository.js.map