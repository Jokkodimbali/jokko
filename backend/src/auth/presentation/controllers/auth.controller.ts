import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { appMessage } from '../../../core/http/app-http.exception';

@ApiTags(API_DOCS.auth.tag)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.sendOtpSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('AUTH_OTP_SENT').message,
  })
  @ApiResponse({
    status: 429,
    description: API_DOCS.auth.sendOtpRateLimit,
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    const result = await this.authService.sendOtp(dto.phoneNumber);
    return createApiResponse(
      { expiresInSeconds: result.expiresInSeconds },
      result.message,
    );
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.verifyOtpSummary })
  @ApiResponse({ status: 200, description: API_DOCS.auth.verifyOtpSuccess })
  @ApiResponse({
    status: 400,
    description: API_DOCS.common.invalidOrExpiredOtp,
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto.phoneNumber, dto.code);
    return createApiResponse(result);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.auth.registerSummary })
  @ApiResponse({ status: 201, description: API_DOCS.auth.registerSuccess })
  @ApiResponse({
    status: 409,
    description: API_DOCS.auth.registerConflict,
  })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return createApiResponse(result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.loginSummary })
  @ApiResponse({ status: 200, description: API_DOCS.auth.loginSuccess })
  @ApiResponse({ status: 401, description: API_DOCS.common.invalidCredentials })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return createApiResponse(result);
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.googleLoginSummary })
  @ApiResponse({ status: 200, description: API_DOCS.auth.googleLoginSuccess })
  @ApiResponse({
    status: 401,
    description: API_DOCS.auth.googleLoginFailure,
  })
  async loginWithGoogle(@Body() dto: GoogleLoginDto) {
    const result = await this.authService.loginWithGoogle(dto.idToken);
    return createApiResponse(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.refreshSummary })
  @ApiResponse({ status: 200, description: API_DOCS.auth.refreshSuccess })
  @ApiResponse({
    status: 401,
    description: API_DOCS.common.invalidOrExpiredRefreshToken,
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return createApiResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.logoutSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('AUTH_LOGOUT_SUCCESS').message,
  })
  async logout(@Body() dto: LogoutDto) {
    const result = await this.authService.logout(dto.refreshToken);
    return createApiResponse(null, result.message);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.auth.meSummary })
  @ApiResponse({ status: 200, description: API_DOCS.common.profileRetrieved })
  @ApiResponse({ status: 401, description: API_DOCS.common.unauthorized })
  @ApiResponse({
    status: 404,
    description: appMessage('AUTH_USER_NOT_FOUND').message,
  })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.authService.getProfile(user.sub);
    return createApiResponse(result);
  }
}
