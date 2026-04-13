import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../application/services/auth.service';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { JwtAuthGuard } from '../../security/jwt-auth.guard';
import { CurrentUser } from '../../security/current-user.decorator';
import type { AuthUser } from '../../security/auth-user.type';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { LogoutDto } from '../dto/logout.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async sendOtp(@Body() dto: SendOtpDto) {
    const result = await this.authService.sendOtp(dto.phoneNumber);
    return createApiResponse(
      { expiresInSeconds: result.expiresInSeconds },
      result.message,
    );
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto.phoneNumber, dto.code);
    return createApiResponse(result);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return createApiResponse(result);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return createApiResponse(result);
  }

  @Post('google/login')
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const result = await this.authService.loginWithGoogle(dto.idToken);
    return createApiResponse(result);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return createApiResponse(result);
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto) {
    const result = await this.authService.logout(dto.refreshToken);
    return createApiResponse(null, result.message);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.authService.getProfile(user.sub);
    return createApiResponse(result);
  }
}
