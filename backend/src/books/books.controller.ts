import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUser } from '../auth/jwt.strategy';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

@UseGuards(JwtAuthGuard)
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) { return this.books.list(user.sub); }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBookDto) { return this.books.create(user.sub, dto); }

  @Get(':bookId')
  get(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) { return this.books.get(user.sub, bookId); }

  @Get(':bookId/content')
  content(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) {
    return this.books.content(user.sub, bookId);
  }

  @Patch(':bookId/progress')
  updateProgress(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string, @Body() dto: UpdateProgressDto) {
    return this.books.updateProgress(user.sub, bookId, dto);
  }

  @Delete(':bookId')
  @HttpCode(204)
  remove(@CurrentUser() user: JwtUser, @Param('bookId') bookId: string) { return this.books.remove(user.sub, bookId); }
}
