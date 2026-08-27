import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtUser } from './jwt.strategy';
import { AuthService } from './auth.service';
import { GoogleService } from './google.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly google: GoogleService) {}

  @Get('google')
  googleLogin(@Res() reply: FastifyReply) {
    const state = randomBytes(32).toString('hex');
    reply.setCookie('googleOAuthState', state, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google', maxAge: 10 * 60,
    });
    return reply.redirect(this.google.createAuthorizationUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    if (error || !code || !state || !this.sameState(state, request.cookies.googleOAuthState)) {
      throw new BadRequestException('A autorização com o Google foi cancelada ou expirou');
    }
    reply.clearCookie('googleOAuthState', { path: '/api/auth/google' });
    const result = await this.google.completeAuthorization(code);
    this.setRefreshCookie(result.refreshToken, reply);
    return reply.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.respond(await this.auth.register(dto), reply);
  }

  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.respond(await this.auth.login(dto), reply);
  }

  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = request.cookies.refreshToken;
    if (!token) return this.auth.refresh('', '');
    const payload = await this.auth.verifyRefreshToken(token);
    return this.respond(await this.auth.refresh(payload.sessionId, token), reply);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: JwtUser, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(user.sessionId);
    reply.clearCookie('refreshToken', { path: '/api/auth' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) { return this.auth.profile(user.sub); }

  private respond(result: { accessToken: string; refreshToken: string; user: unknown }, reply: FastifyReply) {
    this.setRefreshCookie(result.refreshToken, reply);
    return { accessToken: result.accessToken, user: result.user };
  }

  private setRefreshCookie(refreshToken: string, reply: FastifyReply) {
    reply.setCookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: 30 * 24 * 60 * 60 });
  }

  private sameState(received: string, expected?: string) {
    if (!expected || received.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  }
}
