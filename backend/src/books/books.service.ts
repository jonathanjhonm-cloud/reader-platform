import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.book.findMany({
      where: { userId }, include: { progress: true }, orderBy: { updatedAt: 'desc' },
    });
  }

  async get(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId }, include: { progress: true, highlights: true, annotations: true },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');
    return book;
  }

  create(userId: string, dto: CreateBookDto) {
    return this.prisma.book.create({ data: { ...dto, userId } });
  }

  async updateProgress(userId: string, bookId: string, dto: UpdateProgressDto) {
    await this.get(userId, bookId);
    return this.prisma.readingProgress.upsert({
      where: { bookId }, create: { bookId, ...dto }, update: dto,
    });
  }

  async remove(userId: string, bookId: string) {
    await this.get(userId, bookId);
    await this.prisma.book.delete({ where: { id: bookId } });
  }
}
