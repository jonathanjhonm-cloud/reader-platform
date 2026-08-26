import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { GoogleService } from './google.service';

@Module({ imports: [PassportModule, JwtModule.register({})], controllers: [AuthController], providers: [AuthService, GoogleService, JwtStrategy, JwtAuthGuard], exports: [GoogleService, JwtAuthGuard] })
export class AuthModule {}
