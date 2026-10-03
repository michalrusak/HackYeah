import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AuthLoginInputSchema,
  AuthRegisterInputSchema,
  createApiSuccess,
  type ApiSuccessResponse,
  type AuthLoginInput,
  type AuthLogoutData,
  type AuthRegisterInput,
  type AuthSessionData,
} from '@repo/api-contracts';
import type { Request, Response } from 'express';
import { TesterValidationPipe } from '../testers/testers-validation.pipe.js';
import {
  assertTrustedOrigin,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionToken,
} from './auth-http.js';
import {
  AuthService,
  publicUser,
  SESSION_DURATION_MS,
} from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('me')
  async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<AuthSessionData>> {
    response.setHeader('Cache-Control', 'no-store');
    const token = sessionToken(request);
    const account = await this.auth.accountForToken(token);
    if (token && !account)
      response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return createApiSuccess({ user: account ? publicUser(account) : null });
  }

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async register(
    @Body(new TesterValidationPipe(AuthRegisterInputSchema))
    input: AuthRegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<AuthSessionData>> {
    assertTrustedOrigin(request);
    const result = await this.auth.register(input);
    await this.auth.logout(sessionToken(request));
    this.setSession(response, result.token);
    return createApiSuccess({ user: result.user });
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body(new TesterValidationPipe(AuthLoginInputSchema)) input: AuthLoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<AuthSessionData>> {
    assertTrustedOrigin(request);
    const result = await this.auth.login(input);
    await this.auth.logout(sessionToken(request));
    this.setSession(response, result.token);
    return createApiSuccess({ user: result.user });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<AuthLogoutData>> {
    assertTrustedOrigin(request);
    await this.auth.logout(sessionToken(request));
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    response.setHeader('Cache-Control', 'no-store');
    return createApiSuccess({ loggedOut: true });
  }

  private setSession(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });
    response.setHeader('Cache-Control', 'no-store');
  }
}
