import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUser } from '../auth/jwt.strategy';
import { DriveService } from './drive.service';
import { BookProcessingQueueService } from './book-processing-queue.service';

@UseGuards(JwtAuthGuard)
@Controller('drive')
export class DriveController {
  constructor(
    private readonly drive: DriveService,
    private readonly processingQueue: BookProcessingQueueService,
  ) {}

  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.drive.status(user.sub);
  }

  @Get('reading-files')
  list(@CurrentUser() user: JwtUser, @Query('pageToken') pageToken?: string) {
    return this.drive.listReadingFiles(user.sub, pageToken);
  }

  @Get('files/:fileId/content')
  async download(@CurrentUser() user: JwtUser, @Param('fileId') fileId: string, @Res() reply: FastifyReply) {
    const file = await this.drive.downloadFile(user.sub, fileId);
    reply.header('content-type', file.contentType);
    return reply.send(file.data);
  }

  @Post('files/:fileId/import')
  import(@CurrentUser() user: JwtUser, @Param('fileId') fileId: string) {
    return this.processingQueue.enqueueFromDrive(user.sub, fileId);
  }
}
