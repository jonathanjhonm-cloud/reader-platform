import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriveController } from './drive.controller';
import { DriveService } from './drive.service';
import { BookProcessingService } from './book-processing.service';
import { BookProcessingQueueService } from './book-processing-queue.service';

@Module({
  imports: [AuthModule],
  controllers: [DriveController],
  providers: [DriveService, BookProcessingService, BookProcessingQueueService],
})
export class DriveModule {}
