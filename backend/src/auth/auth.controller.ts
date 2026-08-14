import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtUser } from './jwt.strategy';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  me(@CurrentUser() user: JwtUser) { return { id: user.sub, email: user.email }; }

  private respond(result: { accessToken: string; refreshToken: string; user: unknown }, reply: FastifyReply) {
    reply.setCookie('refreshToken', result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth', maxAge: 30 * 24 * 60 * 60 });
    return { accessToken: result.accessToken, user: result.user };
  }
}
