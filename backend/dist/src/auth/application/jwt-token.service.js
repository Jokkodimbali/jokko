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
exports.JwtTokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
function ttlToSeconds(ttl) {
    const numeric = Number(ttl);
    if (!Number.isNaN(numeric)) {
        return numeric;
    }
    const match = ttl.match(/^(\d+)([smhd])$/i);
    if (!match) {
        return 900;
    }
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's':
            return value;
        case 'm':
            return value * 60;
        case 'h':
            return value * 3600;
        case 'd':
            return value * 86400;
        default:
            return 900;
    }
}
let JwtTokenService = class JwtTokenService {
    jwtService;
    configService;
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async issueTokens(payload) {
        const accessTtl = ttlToSeconds(this.configService.get('JWT_ACCESS_TTL') ?? '15m');
        const refreshTtl = ttlToSeconds(this.configService.get('JWT_REFRESH_TTL') ?? '30d');
        const accessToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_ACCESS_SECRET'),
            expiresIn: accessTtl,
        });
        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: refreshTtl,
            jwtid: (0, crypto_1.randomUUID)(),
        });
        return { accessToken, refreshToken };
    }
    async verifyRefreshToken(token) {
        return this.jwtService.verifyAsync(token, {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
        });
    }
    getRefreshTokenExpiryDate() {
        const refreshTtl = ttlToSeconds(this.configService.get('JWT_REFRESH_TTL') ?? '30d');
        return new Date(Date.now() + refreshTtl * 1000);
    }
};
exports.JwtTokenService = JwtTokenService;
exports.JwtTokenService = JwtTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], JwtTokenService);
//# sourceMappingURL=jwt-token.service.js.map