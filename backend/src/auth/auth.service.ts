import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Este e-mail já está em uso');
    const user = await this.prisma.user.create({
      data: { email, name: dto.name?.trim(), passwordHash: await argon2.hash(dto.password) },
    });
    return this.createSessionForUser(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return this.createSessionForUser(user.id, user.email);
  }

  async refresh(sessionId: string, refreshToken: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.expiresAt < new Date() || !(await argon2.verify(session.refreshTokenHash, refreshToken))) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
    await this.prisma.session.delete({ where: { id: session.id } });
    return this.createSessionForUser(session.user.id, session.user.email);
  }

  verifyRefreshToken(token: string) {
    return this.jwt.verifyAsync<{ sessionId: string }>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async createSessionForUser(userId: string, email: string) {
    const expiresIn = (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d') as never;
    const accessExpiresIn = (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m') as never;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({ data: { userId, expiresAt, refreshTokenHash: 'pending' } });
    const payload = { sub: userId, email, sessionId: session.id };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: accessExpiresIn }),
      this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn }),
    ]);
    await this.prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: await argon2.hash(refreshToken) } });
    return { accessToken, refreshToken, user: { id: userId, email } };
  }
}
