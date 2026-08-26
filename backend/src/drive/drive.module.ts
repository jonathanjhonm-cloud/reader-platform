import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';

@Module({ imports: [AuthModule], controllers: [DriveController], providers: [DriveService] })
export class DriveModule {}
