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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_token_service_1 = require("./jwt-token.service");
const phone_number_validator_1 = require("../domain/validators/phone-number.validator");
const password_hash_service_1 = require("./password-hash.service");
const refresh_session_service_1 = require("./refresh-session.service");
const google_auth_service_1 = require("./google-auth.service");
const app_http_exception_1 = require("../../core/http/app-http.exception");
const auth_repository_port_1 = require("./ports/auth-repository.port");
const otp_port_1 = require("./ports/otp.port");
let AuthService = class AuthService {
    authRepository;
    otpService;
    jwtTokenService;
    phoneNumberValidator;
    passwordHashService;
    refreshSessionService;
    googleAuthService;
    constructor(authRepository, otpService, jwtTokenService, phoneNumberValidator, passwordHashService, refreshSessionService, googleAuthService) {
        this.authRepository = authRepository;
        this.otpService = otpService;
        this.jwtTokenService = jwtTokenService;
        this.phoneNumberValidator = phoneNumberValidator;
        this.passwordHashService = passwordHashService;
        this.refreshSessionService = refreshSessionService;
        this.googleAuthService = googleAuthService;
    }
    async sendOtp(phoneNumber) {
        const normalizedPhoneNumber = this.phoneNumberValidator.normalizeOrThrow(phoneNumber);
        const otp = await this.otpService.create(normalizedPhoneNumber);
        const successMessage = (0, app_http_exception_1.appMessage)('AUTH_OTP_SENT');
        return {
            success: true,
            message: successMessage.message,
            expiresInSeconds: otp.expiresInSeconds,
        };
    }
    async verifyOtp(phoneNumber, code) {
        const normalizedPhoneNumber = this.phoneNumberValidator.normalizeOrThrow(phoneNumber);
        await this.otpService.verify(normalizedPhoneNumber, code);
        let user = await this.authRepository.findByPhoneNumber(normalizedPhoneNumber);
        if (!user) {
            user = await this.authRepository.createClientByPhoneNumber(normalizedPhoneNumber);
        }
        const { accessToken, refreshToken } = await this.issueTokensAndPersistSession(user);
        return {
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: this.toApiUser(user),
            },
        };
    }
    async register(command) {
        const phoneNumber = this.phoneNumberValidator.normalizeOrThrow(command.phoneNumber);
        const existing = await this.authRepository.findByPhoneNumber(phoneNumber);
        if (existing) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_PHONE_ALREADY_USED');
        }
        const passwordHash = await this.passwordHashService.hash(command.password);
        const user = await this.authRepository.createClientWithPassword({
            phoneNumber,
            name: command.name.trim(),
            email: command.email?.trim().toLowerCase(),
            passwordHash,
        });
        const { accessToken, refreshToken } = await this.issueTokensAndPersistSession(user);
        return {
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: this.toApiUser(user),
            },
        };
    }
    async login(command) {
        const phoneNumber = this.phoneNumberValidator.normalizeOrThrow(command.phoneNumber);
        const user = await this.authRepository.findWithPasswordByPhoneNumber(phoneNumber);
        if (!user?.motDePasseHash) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_INVALID_CREDENTIALS');
        }
        const isValidPassword = await this.passwordHashService.compare(command.password, user.motDePasseHash);
        if (!isValidPassword) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_INVALID_CREDENTIALS');
        }
        const { accessToken, refreshToken } = await this.issueTokensAndPersistSession(user);
        return {
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: this.toApiUser(user),
            },
        };
    }
    async refresh(refreshToken) {
        const session = await this.refreshSessionService.assertValid(refreshToken);
        let payload;
        try {
            payload = await this.jwtTokenService.verifyRefreshToken(refreshToken);
        }
        catch {
            throw (0, app_http_exception_1.appHttpException)('AUTH_REFRESH_TOKEN_INVALID');
        }
        if (session.utilisateurId !== payload.sub) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_REFRESH_TOKEN_INVALID');
        }
        const user = await this.authRepository.findById(payload.sub);
        if (!user) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_REFRESH_TOKEN_INVALID');
        }
        const newTokens = await this.jwtTokenService.issueTokens({
            sub: user.id,
            role: user.role,
            phoneNumber: user.numeroTelephone,
        });
        await this.refreshSessionService.rotate(session.id, user.id, newTokens.refreshToken, this.jwtTokenService.getRefreshTokenExpiryDate());
        return {
            success: true,
            data: newTokens,
        };
    }
    async loginWithGoogle(idToken) {
        const googlePayload = await this.googleAuthService.verifyIdToken(idToken);
        const email = googlePayload.email?.toLowerCase();
        if (!email) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_GOOGLE_ACCOUNT_INVALID');
        }
        const user = await this.authRepository.findByEmail(email);
        if (!user) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_GOOGLE_ACCOUNT_NOT_LINKED');
        }
        await this.authRepository.linkGoogleIdentity(user.id, googlePayload.sub);
        const { accessToken, refreshToken } = await this.issueTokensAndPersistSession(user);
        return {
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    ...this.toApiUser(user),
                    email: user.email,
                },
            },
        };
    }
    async logout(refreshToken) {
        await this.refreshSessionService.revoke(refreshToken);
        const successMessage = (0, app_http_exception_1.appMessage)('AUTH_LOGOUT_SUCCESS');
        return {
            success: true,
            message: successMessage.message,
        };
    }
    async getProfile(userId) {
        const user = await this.authRepository.findPublicProfileById(userId);
        if (!user) {
            throw (0, app_http_exception_1.appHttpException)('AUTH_USER_NOT_FOUND');
        }
        return { success: true, data: user };
    }
    async issueTokensAndPersistSession(user) {
        const tokens = await this.jwtTokenService.issueTokens({
            sub: user.id,
            role: user.role,
            phoneNumber: user.numeroTelephone,
        });
        await this.refreshSessionService.persist(user.id, tokens.refreshToken, this.jwtTokenService.getRefreshTokenExpiryDate());
        return tokens;
    }
    toApiUser(user) {
        return {
            id: user.id,
            phoneNumber: user.numeroTelephone,
            name: user.nom,
            role: user.role,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(auth_repository_port_1.AUTH_REPOSITORY_PORT)),
    __param(1, (0, common_1.Inject)(otp_port_1.OTP_PORT)),
    __metadata("design:paramtypes", [Object, Object, jwt_token_service_1.JwtTokenService,
        phone_number_validator_1.PhoneNumberValidator,
        password_hash_service_1.PasswordHashService,
        refresh_session_service_1.RefreshSessionService,
        google_auth_service_1.GoogleAuthService])
], AuthService);
//# sourceMappingURL=auth.service.js.map