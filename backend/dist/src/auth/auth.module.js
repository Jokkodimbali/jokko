"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_controller_1 = require("./presentation/auth.controller");
const auth_service_1 = require("./application/auth.service");
const jwt_token_service_1 = require("./application/jwt-token.service");
const password_hash_service_1 = require("./application/password-hash.service");
const refresh_session_service_1 = require("./application/refresh-session.service");
const google_auth_service_1 = require("./application/google-auth.service");
const otp_service_1 = require("./infrastructure/otp.service");
const jwt_auth_guard_1 = require("./security/jwt-auth.guard");
const auth_repository_1 = require("./infrastructure/repositories/auth.repository");
const otp_repository_1 = require("./infrastructure/repositories/otp.repository");
const phone_number_validator_1 = require("./domain/validators/phone-number.validator");
const auth_repository_port_1 = require("./application/ports/auth-repository.port");
const otp_port_1 = require("./application/ports/otp.port");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    secret: configService.get('JWT_ACCESS_SECRET'),
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            jwt_token_service_1.JwtTokenService,
            password_hash_service_1.PasswordHashService,
            refresh_session_service_1.RefreshSessionService,
            google_auth_service_1.GoogleAuthService,
            otp_service_1.OtpService,
            jwt_auth_guard_1.JwtAuthGuard,
            auth_repository_1.AuthRepository,
            otp_repository_1.OtpRepository,
            phone_number_validator_1.PhoneNumberValidator,
            {
                provide: auth_repository_port_1.AUTH_REPOSITORY_PORT,
                useExisting: auth_repository_1.AuthRepository,
            },
            {
                provide: otp_port_1.OTP_PORT,
                useExisting: otp_service_1.OtpService,
            },
        ],
        exports: [auth_service_1.AuthService, jwt_1.JwtModule, jwt_auth_guard_1.JwtAuthGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map