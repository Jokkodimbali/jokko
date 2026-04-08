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
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const otp_repository_1 = require("./repositories/otp.repository");
const app_http_exception_1 = require("../../core/http/app-http.exception");
let OtpService = class OtpService {
    otpRepository;
    ttlMs = 5 * 60 * 1000;
    maxAttempts = 5;
    resendCooldownMs = 60 * 1000;
    constructor(otpRepository) {
        this.otpRepository = otpRepository;
    }
    hashCode(code) {
        return (0, crypto_1.createHash)('sha256').update(code).digest('hex');
    }
    async create(phoneNumber) {
        const existing = await this.otpRepository.findByPhoneNumber(phoneNumber);
        if (existing &&
            Date.now() - existing.dernierEnvoiLe.getTime() < this.resendCooldownMs) {
            const message = (0, app_http_exception_1.appMessage)('AUTH_OTP_RESEND_TOO_EARLY');
            throw new common_1.HttpException({
                message: message.message,
                errorCode: message.code,
            }, message.httpStatus);
        }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        await this.otpRepository.upsertForPhoneNumber({
            phoneNumber,
            codeHash: this.hashCode(code),
            expiresAt: new Date(Date.now() + this.ttlMs),
            lastSentAt: new Date(),
        });
        return {
            expiresInSeconds: Math.floor(this.ttlMs / 1000),
        };
    }
    async verify(phoneNumber, code) {
        const entry = await this.otpRepository.findByPhoneNumber(phoneNumber);
        if (!entry) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_OTP_INVALID_OR_EXPIRED');
        }
        if (entry.consommeLe || Date.now() > entry.expireLe.getTime()) {
            await this.otpRepository.delete(entry.id);
            throw (0, app_http_exception_1.appHttpException)('AUTH_OTP_INVALID_OR_EXPIRED');
        }
        if (entry.tentatives >= this.maxAttempts) {
            await this.otpRepository.delete(entry.id);
            const message = (0, app_http_exception_1.appMessage)('AUTH_OTP_TOO_MANY_REQUESTS');
            throw new common_1.HttpException({
                message: message.message,
                errorCode: message.code,
            }, message.httpStatus);
        }
        const inputHash = this.hashCode(code);
        if (entry.hashCode !== inputHash) {
            await this.otpRepository.incrementAttempts(entry.id);
            throw (0, app_http_exception_1.appHttpException)('AUTH_OTP_INVALID_OR_EXPIRED');
        }
        await this.otpRepository.consume(entry.id);
        return true;
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [otp_repository_1.OtpRepository])
], OtpService);
//# sourceMappingURL=otp.service.js.map