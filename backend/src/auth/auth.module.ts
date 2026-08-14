import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({ imports: [PassportModule, JwtModule.register({})], controllers: [AuthController], providers: [AuthService, JwtStrategy, JwtAuthGuard], exports: [JwtAuthGuard] })
export class AuthModule {}
