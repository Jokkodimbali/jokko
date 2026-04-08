import { Inject, Injectable } from '@nestjs/common';
import { JwtTokenService } from './jwt-token.service';
import { PhoneNumberValidator } from '../domain/validators/phone-number.validator';
import { PasswordHashService } from './password-hash.service';
import { RefreshSessionService } from './refresh-session.service';
import { GoogleAuthService } from './google-auth.service';
import {
  appHttpException,
  appMessage,
} from '../../core/http/app-http.exception';
import {
  AUTH_REPOSITORY_PORT,
  type AuthUserSummary,
  type AuthRepositoryPort,
} from './ports/auth-repository.port';
import { OTP_PORT, type OtpPort } from './ports/otp.port';
import type { LoginCommand, RegisterCommand } from './commands/auth.commands';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY_PORT)
    private readonly authRepository: AuthRepositoryPort,
    @Inject(OTP_PORT)
    private readonly otpService: OtpPort,
    private readonly jwtTokenService: JwtTokenService,
    private readonly phoneNumberValidator: PhoneNumberValidator,
    private readonly passwordHashService: PasswordHashService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  async sendOtp(phoneNumber: string) {
    const normalizedPhoneNumber =
      this.phoneNumberValidator.normalizeOrThrow(phoneNumber);
    const otp = await this.otpService.create(normalizedPhoneNumber);
    const successMessage = appMessage('AUTH_OTP_SENT');
    return {
      success: true,
      message: successMessage.message,
      expiresInSeconds: otp.expiresInSeconds,
    };
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const normalizedPhoneNumber =
      this.phoneNumberValidator.normalizeOrThrow(phoneNumber);
    await this.otpService.verify(normalizedPhoneNumber, code);

    let user = await this.authRepository.findByPhoneNumber(
      normalizedPhoneNumber,
    );

    if (!user) {
      user = await this.authRepository.createClientByPhoneNumber(
        normalizedPhoneNumber,
      );
    }

    const { accessToken, refreshToken } =
      await this.issueTokensAndPersistSession(user);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: this.toApiUser(user),
      },
    };
  }

  async register(command: RegisterCommand) {
    const phoneNumber = this.phoneNumberValidator.normalizeOrThrow(
      command.phoneNumber,
    );
    const existing = await this.authRepository.findByPhoneNumber(phoneNumber);
    if (existing) {
      throw appHttpException('AUTH_PHONE_ALREADY_USED');
    }

    const passwordHash = await this.passwordHashService.hash(command.password);
    const user = await this.authRepository.createClientWithPassword({
      phoneNumber,
      name: command.name.trim(),
      email: command.email?.trim().toLowerCase(),
      passwordHash,
    });

    const { accessToken, refreshToken } =
      await this.issueTokensAndPersistSession(user);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: this.toApiUser(user),
      },
    };
  }

  async login(command: LoginCommand) {
    const phoneNumber = this.phoneNumberValidator.normalizeOrThrow(
      command.phoneNumber,
    );
    const user =
      await this.authRepository.findWithPasswordByPhoneNumber(phoneNumber);
    if (!user?.motDePasseHash) {
      throw appHttpException('AUTH_INVALID_CREDENTIALS');
    }

    const isValidPassword = await this.passwordHashService.compare(
      command.password,
      user.motDePasseHash,
    );
    if (!isValidPassword) {
      throw appHttpException('AUTH_INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken } =
      await this.issueTokensAndPersistSession(user);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: this.toApiUser(user),
      },
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.refreshSessionService.assertValid(refreshToken);
    let payload: Awaited<ReturnType<JwtTokenService['verifyRefreshToken']>>;
    try {
      payload = await this.jwtTokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }
    if (session.utilisateurId !== payload.sub) {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }

    const user = await this.authRepository.findById(payload.sub);
    if (!user) {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }

    const newTokens = await this.jwtTokenService.issueTokens({
      sub: user.id,
      role: user.role,
      phoneNumber: user.numeroTelephone,
    });
    await this.refreshSessionService.rotate(
      session.id,
      user.id,
      newTokens.refreshToken,
      this.jwtTokenService.getRefreshTokenExpiryDate(),
    );

    return {
      success: true,
      data: newTokens,
    };
  }

  async loginWithGoogle(idToken: string) {
    const googlePayload = await this.googleAuthService.verifyIdToken(idToken);
    const email = googlePayload.email?.toLowerCase();
    if (!email) {
      throw appHttpException('AUTH_GOOGLE_ACCOUNT_INVALID');
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw appHttpException('AUTH_GOOGLE_ACCOUNT_NOT_LINKED');
    }

    await this.authRepository.linkGoogleIdentity(user.id, googlePayload.sub);
    const { accessToken, refreshToken } =
      await this.issueTokensAndPersistSession(user);

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

  async logout(refreshToken: string) {
    await this.refreshSessionService.revoke(refreshToken);
    const successMessage = appMessage('AUTH_LOGOUT_SUCCESS');
    return {
      success: true,
      message: successMessage.message,
    };
  }

  async getProfile(userId: string) {
    const user = await this.authRepository.findPublicProfileById(userId);
    if (!user) {
      throw appHttpException('AUTH_USER_NOT_FOUND');
    }

    return { success: true, data: user };
  }

  private async issueTokensAndPersistSession(user: AuthUserSummary) {
    const tokens = await this.jwtTokenService.issueTokens({
      sub: user.id,
      role: user.role,
      phoneNumber: user.numeroTelephone,
    });

    await this.refreshSessionService.persist(
      user.id,
      tokens.refreshToken,
      this.jwtTokenService.getRefreshTokenExpiryDate(),
    );

    return tokens;
  }

  private toApiUser(user: AuthUserSummary) {
    return {
      id: user.id,
      phoneNumber: user.numeroTelephone,
      name: user.nom,
      role: user.role,
    };
  }
}
