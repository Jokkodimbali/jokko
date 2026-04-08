import { JwtTokenService } from './jwt-token.service';
import { PhoneNumberValidator } from '../domain/validators/phone-number.validator';
import { PasswordHashService } from './password-hash.service';
import { RefreshSessionService } from './refresh-session.service';
import { GoogleAuthService } from './google-auth.service';
import { type AuthRepositoryPort } from './ports/auth-repository.port';
import { type OtpPort } from './ports/otp.port';
import type { LoginCommand, RegisterCommand } from './commands/auth.commands';
export declare class AuthService {
    private readonly authRepository;
    private readonly otpService;
    private readonly jwtTokenService;
    private readonly phoneNumberValidator;
    private readonly passwordHashService;
    private readonly refreshSessionService;
    private readonly googleAuthService;
    constructor(authRepository: AuthRepositoryPort, otpService: OtpPort, jwtTokenService: JwtTokenService, phoneNumberValidator: PhoneNumberValidator, passwordHashService: PasswordHashService, refreshSessionService: RefreshSessionService, googleAuthService: GoogleAuthService);
    sendOtp(phoneNumber: string): Promise<{
        success: boolean;
        message: string;
        expiresInSeconds: number;
    }>;
    verifyOtp(phoneNumber: string, code: string): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
            user: {
                id: string;
                phoneNumber: string;
                name: string;
                role: import("@prisma/client").$Enums.RoleUtilisateur;
            };
        };
    }>;
    register(command: RegisterCommand): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
            user: {
                id: string;
                phoneNumber: string;
                name: string;
                role: import("@prisma/client").$Enums.RoleUtilisateur;
            };
        };
    }>;
    login(command: LoginCommand): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
            user: {
                id: string;
                phoneNumber: string;
                name: string;
                role: import("@prisma/client").$Enums.RoleUtilisateur;
            };
        };
    }>;
    refresh(refreshToken: string): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    loginWithGoogle(idToken: string): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
            user: {
                email: string | null;
                id: string;
                phoneNumber: string;
                name: string;
                role: import("@prisma/client").$Enums.RoleUtilisateur;
            };
        };
    }>;
    logout(refreshToken: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getProfile(userId: string): Promise<{
        success: boolean;
        data: import("./ports/auth-repository.port").AuthPublicProfile;
    }>;
    private issueTokensAndPersistSession;
    private toApiUser;
}
