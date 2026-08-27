import { Module } from '@nestjs/common';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ReaderAssistantService } from './reader-assistant.service';
import { BookProcessingService } from '../drive/book-processing.service';
import { DriveService } from '../drive/drive.service';
import { AuthModule } from '../auth/auth.module';
import { BookCoverService } from './book-cover.service';
import { BookIntelligenceService } from '../drive/book-intelligence.service';

@Module({
  imports: [AuthModule],
  controllers: [BooksController],
  providers: [BooksService, ReaderAssistantService, BookCoverService, BookIntelligenceService, BookProcessingService, DriveService],
})
export class BooksModule {}
