import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { JwtTokenService } from '../../application/services/jwt-token.service';
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
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.auth.tag)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly configService: ConfigService,
  ) {}

  @Post('otp/send')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.sendOtpSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('AUTH_OTP_SENT').message,
    messageExample: appMessage('AUTH_OTP_SENT').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.otpSentData,
    },
  })
  @ApiStandardErrorResponse({
    status: 429,
    description: API_DOCS.auth.sendOtpRateLimit,
    errorCode: 'AUTH_OTP_TOO_MANY_REQUESTS',
    messageExample: API_DOCS.auth.sendOtpRateLimit,
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
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.auth.verifyOtpSuccess,
    messageExample: API_DOCS.auth.verifyOtpSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.tokenPairData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.invalidOrExpiredOtp,
    errorCode: 'AUTH_OTP_INVALID_OR_EXPIRED',
    messageExample: API_DOCS.common.invalidOrExpiredOtp,
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyOtp(dto.phoneNumber, dto.code, {
      userAgent: this.readUserAgent(request),
    });
    return createApiResponse(
      this.persistAuthCookies(response, result),
      API_DOCS.auth.verifyOtpSuccess,
    );
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.auth.registerSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.auth.registerSuccess,
    messageExample: API_DOCS.auth.registerSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.tokenPairData,
    },
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.auth.registerConflict,
    errorCode: 'AUTH_PHONE_ALREADY_USED',
    messageExample: API_DOCS.auth.registerConflict,
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto, {
      userAgent: this.readUserAgent(request),
    });
    return createApiResponse(
      this.persistAuthCookies(response, result),
      API_DOCS.auth.registerSuccess,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.loginSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.auth.loginSuccess,
    messageExample: API_DOCS.auth.loginSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.tokenPairData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.invalidCredentials,
    errorCode: 'AUTH_INVALID_CREDENTIALS',
    messageExample: API_DOCS.common.invalidCredentials,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: this.readUserAgent(request),
    });
    return createApiResponse(
      this.persistAuthCookies(response, result),
      API_DOCS.auth.loginSuccess,
    );
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.googleLoginSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.auth.googleLoginSuccess,
    messageExample: API_DOCS.auth.googleLoginSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.tokenPairData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.auth.googleLoginFailure,
    errorCode: 'AUTH_GOOGLE_ACCOUNT_INVALID',
    messageExample: API_DOCS.auth.googleLoginFailure,
  })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithGoogle(dto.idToken, {
      userAgent: this.readUserAgent(request),
    });
    return createApiResponse(
      this.persistAuthCookies(response, result),
      API_DOCS.auth.googleLoginSuccess,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.refreshSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.auth.refreshSuccess,
    messageExample: API_DOCS.auth.refreshSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.tokenPairData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.invalidOrExpiredRefreshToken,
    errorCode: 'AUTH_REFRESH_TOKEN_INVALID',
    messageExample: API_DOCS.common.invalidOrExpiredRefreshToken,
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      dto.refreshToken ?? this.readCookie(request, 'jokko_refresh_token');
    if (!refreshToken) {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }

    const result = await this.authService.refresh(refreshToken, {
      userAgent: this.readUserAgent(request),
    });
    return createApiResponse(
      this.persistAuthCookies(response, result),
      API_DOCS.auth.refreshSuccess,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.auth.logoutSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('AUTH_LOGOUT_SUCCESS').message,
    messageExample: appMessage('AUTH_LOGOUT_SUCCESS').message,
    dataSchema: {
      type: 'null',
      example: null,
    },
  })
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken =
      dto.refreshToken ?? this.readCookie(request, 'jokko_refresh_token');
    if (!refreshToken) {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }

    const result = await this.authService.logout(refreshToken);
    this.clearAuthCookies(response);
    return createApiResponse(null, result.message);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: API_DOCS.auth.meSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.common.profileRetrieved,
    messageExample: API_DOCS.common.profileRetrieved,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.auth.meData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('AUTH_USER_NOT_FOUND').message,
    errorCode: 'AUTH_USER_NOT_FOUND',
    messageExample: appMessage('AUTH_USER_NOT_FOUND').message,
  })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.authService.getProfile(user.sub);
    return createApiResponse(result);
  }

  private persistAuthCookies(
    response: Response,
    result: {
      accessToken: string;
      refreshToken: string;
      user: unknown;
    },
  ) {
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    response.cookie('jokko_access_token', accessToken, {
      ...this.cookieOptions(),
      maxAge: this.jwtTokenService.getAccessTokenMaxAgeMs(),
    });
    response.cookie('jokko_refresh_token', refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.jwtTokenService.getRefreshTokenMaxAgeMs(),
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie('jokko_access_token', this.cookieOptions());
    response.clearCookie('jokko_refresh_token', this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      path: '/',
    };
  }

  private readCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;

    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));

    return cookie
      ? decodeURIComponent(cookie.split('=').slice(1).join('='))
      : null;
  }

  private readUserAgent(request: Request): string | undefined {
    const value = request.headers['user-agent'];
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
