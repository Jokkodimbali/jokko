import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthService } from './application/services/auth.service';
import { JwtTokenService } from './application/services/jwt-token.service';
import { PasswordHashService } from './application/services/password-hash.service';
import { RefreshSessionService } from './application/services/refresh-session.service';
import { GoogleAuthService } from './application/services/google-auth.service';
import { OtpService } from './application/services/otp.service';
import { JwtAuthGuard } from './security/jwt-auth.guard';
import { AuthRepository } from './infrastructure/repositories/auth.repository';
import { OtpRepository } from './infrastructure/repositories/otp.repository';
import { PhoneNumberValidator } from './domain/validators/phone-number.validator';
import { AUTH_REPOSITORY_PORT } from './application/ports/auth-repository.port';
import { OTP_PORT } from './application/ports/otp.port';
import { OTP_REPOSITORY_PORT } from './application/ports/otp-repository.port';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokenService,
    PasswordHashService,
    RefreshSessionService,
    GoogleAuthService,
    OtpService,
    JwtAuthGuard,
    AuthRepository,
    OtpRepository,
    PhoneNumberValidator,
    {
      provide: AUTH_REPOSITORY_PORT,
      useExisting: AuthRepository,
    },
    {
      provide: OTP_PORT,
      useExisting: OtpService,
    },
    {
      provide: OTP_REPOSITORY_PORT,
      useExisting: OtpRepository,
    },
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
