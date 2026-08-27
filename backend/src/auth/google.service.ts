import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

type GoogleTokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };
type GoogleProfile = { sub: string; email: string; name?: string };

@Injectable()
export class GoogleService {
  private readonly scopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.readonly'];

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  createAuthorizationUrl(state: string) {
    const query = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  }

  async connectionStatus(userId: string) {
    const configured = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_TOKEN_ENCRYPTION_KEY']
      .every((key) => Boolean(this.config.get<string>(key)));
    const connected = configured && Boolean(await this.prisma.googleAccount.findUnique({ where: { userId }, select: { id: true } }));
    return { configured, connected };
  }

  async completeAuthorization(code: string) {
    const tokens = await this.requestTokens(new URLSearchParams({
      code,
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }));
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) throw new BadGatewayException('Não foi possível obter o perfil do Google');
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profile.email || !profile.sub) throw new BadGatewayException('O Google não retornou uma conta válida');

    const existingGoogle = await this.prisma.googleAccount.findUnique({ where: { googleId: profile.sub } });
    const user = existingGoogle
      ? await this.prisma.user.findUniqueOrThrow({ where: { id: existingGoogle.userId } })
      : await this.prisma.user.upsert({
          where: { email: profile.email.toLowerCase() },
          update: { name: profile.name },
          create: { email: profile.email.toLowerCase(), name: profile.name },
        });

    const refreshToken = tokens.refresh_token ?? (await this.prisma.googleAccount.findUnique({ where: { userId: user.id } }))?.refreshTokenEncrypted;
    if (!refreshToken) throw new BadGatewayException('O Google não forneceu um refresh token. Tente conectar novamente.');
    const encryptedRefreshToken = tokens.refresh_token ? this.encrypt(tokens.refresh_token) : refreshToken;
    await this.prisma.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id, googleId: profile.sub, accessTokenEncrypted: this.encrypt(tokens.access_token),
        refreshTokenEncrypted: encryptedRefreshToken, accessTokenExpiresAt: this.expiry(tokens.expires_in),
      },
      update: {
        googleId: profile.sub, accessTokenEncrypted: this.encrypt(tokens.access_token),
        refreshTokenEncrypted: encryptedRefreshToken, accessTokenExpiresAt: this.expiry(tokens.expires_in),
      },
    });
    return this.auth.createSessionForUser(user.id, user.email);
  }

  async getAccessToken(userId: string) {
    const account = await this.prisma.googleAccount.findUnique({ where: { userId } });
    if (!account) throw new UnauthorizedException('Conta Google não conectada');
    if (account.accessTokenExpiresAt && account.accessTokenExpiresAt > new Date(Date.now() + 60_000)) {
      return this.decrypt(account.accessTokenEncrypted);
    }
    const tokens = await this.requestTokens(new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      refresh_token: this.decrypt(account.refreshTokenEncrypted),
      grant_type: 'refresh_token',
    }));
    await this.prisma.googleAccount.update({
      where: { userId }, data: { accessTokenEncrypted: this.encrypt(tokens.access_token), accessTokenExpiresAt: this.expiry(tokens.expires_in) },
    });
    return tokens.access_token;
  }

  private async requestTokens(body: URLSearchParams) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!response.ok) throw new BadGatewayException('Não foi possível concluir a autorização com o Google');
    return await response.json() as GoogleTokenResponse;
  }

  private expiry(seconds?: number) { return seconds ? new Date(Date.now() + seconds * 1000) : null; }
  private tokenKey() {
    const key = Buffer.from(this.config.getOrThrow<string>('GOOGLE_TOKEN_ENCRYPTION_KEY'), 'base64');
    if (key.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY deve conter 32 bytes em Base64');
    return key;
  }
  private encrypt(value: string) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.tokenKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
  private decrypt(value: string) {
    const payload = Buffer.from(value, 'base64'); const iv = payload.subarray(0, 12); const tag = payload.subarray(12, 28);
    const decipher = createDecipheriv('aes-256-gcm', this.tokenKey(), iv); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
  }
}
