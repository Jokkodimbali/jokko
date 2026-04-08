import { AuthService } from '../application/auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import type { AuthUser } from '../security/auth-user.type';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    sendOtp(dto: SendOtpDto): Promise<{
        success: boolean;
        message: string;
        expiresInSeconds: number;
    }>;
    verifyOtp(dto: VerifyOtpDto): Promise<{
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
    register(dto: RegisterDto): Promise<{
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
    login(dto: LoginDto): Promise<{
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
    loginWithGoogle(dto: GoogleLoginDto): Promise<{
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
    refresh(dto: RefreshTokenDto): Promise<{
        success: boolean;
        data: {
            accessToken: string;
            refreshToken: string;
        };
    }>;
    logout(dto: LogoutDto): Promise<{
        success: boolean;
        message: string;
    }>;
    me(user: AuthUser): Promise<{
        success: boolean;
        data: import("../application/ports/auth-repository.port").AuthPublicProfile;
    }>;
}
