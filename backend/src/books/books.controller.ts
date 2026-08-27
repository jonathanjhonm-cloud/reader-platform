import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUser } from '../auth/jwt.strategy';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { AssistantRequestDto } from './dto/assistant-request.dto';
import { ReaderAssistantService } from './reader-assistant.service';
import { BookProcessingService } from '../drive/book-processing.service';

@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly processing: BookProcessingService,
    private readonly assistant: ReaderAssistantService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtUser) { return this.books.list(user.sub); }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBookDto) { return this.books.create(user.sub, dto); }

  @Post('upload')
  async upload(@CurrentUser() user: JwtUser, @Req() request: FastifyRequest) {
    const file = await request.file();
    if (!file) throw new BadRequestException('Selecione um arquivo PDF ou EPUB');
    return this.processing.importUpload(user.sub, file.filename, file.mimetype, await file.toBuffer());
  }

  @Get(':bookId')
  get(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) { return this.books.get(user.sub, bookId); }

  @Get(':bookId/content')
  content(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) {
    return this.books.content(user.sub, bookId);
  }

  @Get(':bookId/cover')
  async cover(
    @CurrentUser() user: JwtUser,
    @Param('bookId') bookId: string,
    @Res() reply: FastifyReply,
  ) {
    const cover = await this.books.cover(user.sub, bookId);
    reply.header('content-type', cover.mimeType);
    reply.header('cache-control', 'private, max-age=86400');
    return reply.send(cover.data);
  }

  @Post(':bookId/cover/refresh')
  refreshCover(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) {
    return this.books.refreshCover(user.sub, bookId);
  }

  @Patch(':bookId/progress')
  updateProgress(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string, @Body() dto: UpdateProgressDto) {
    return this.books.updateProgress(user.sub, bookId, dto);
  }

  @Post(':bookId/assistant')
  askAssistant(
    @CurrentUser() user: JwtUser,
    @Param('bookId') bookId: string,
    @Body() dto: AssistantRequestDto,
  ) {
    return this.assistant.ask(user.sub, bookId, dto);
  }

  @Delete(':bookId')
  @HttpCode(204)
  remove(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) { return this.books.remove(user.sub, bookId); }
}
