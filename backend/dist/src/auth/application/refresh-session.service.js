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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshSessionService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const app_http_exception_1 = require("../../core/http/app-http.exception");
const auth_repository_port_1 = require("./ports/auth-repository.port");
let RefreshSessionService = class RefreshSessionService {
    authRepository;
    constructor(authRepository) {
        this.authRepository = authRepository;
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    async persist(userId, refreshToken, expiresAt) {
        const tokenHash = this.hashToken(refreshToken);
        return this.authRepository.createRefreshSession(userId, tokenHash, expiresAt);
    }
    async assertValid(refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        const session = await this.authRepository.findActiveSessionByTokenHash(tokenHash);
        if (!session) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_REFRESH_TOKEN_INVALID');
        }
        if (session.expireLe.getTime() <= Date.now()) {
            await this.authRepository.revokeSessionById(session.id);
            throw (0, app_http_exception_1.appHttpException)('AUTH_REFRESH_TOKEN_INVALID');
        }
        return session;
    }
    async revoke(refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        await this.authRepository.revokeSessionByTokenHash(tokenHash);
    }
    async rotate(oldSessionId, userId, newRefreshToken, expiresAt) {
        const newTokenHash = this.hashToken(newRefreshToken);
        await this.authRepository.rotateSessionToken(oldSessionId, userId, newTokenHash, expiresAt);
    }
};
exports.RefreshSessionService = RefreshSessionService;
exports.RefreshSessionService = RefreshSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_repository_port_1.AUTH_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object])
], RefreshSessionService);
//# sourceMappingURL=refresh-session.service.js.map