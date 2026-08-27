import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { BookCoverService } from './book-cover.service';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService, private readonly covers: BookCoverService) {}

  list(userId: string) {
    return this.prisma.book.findMany({
      where: { userId },
      select: {
        id: true, title: true, author: true, fileType: true, coverUrl: true, coverMimeType: true,
        processingStatus: true, processingError: true, wordCount: true, updatedAt: true, progress: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId }, omit: { coverData: true },
      include: { progress: true, highlights: true, annotations: true },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');
    return book;
  }

  async cover(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { coverData: true, coverMimeType: true },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');
    if (!book.coverData || !book.coverMimeType) throw new NotFoundException('Este livro ainda não possui capa');
    return { data: Buffer.from(book.coverData), mimeType: book.coverMimeType };
  }

  async refreshCover(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId }, select: { id: true, title: true, author: true, coverData: true, coverMimeType: true },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');
    if (book.coverData && book.coverMimeType) return { available: true, coverUrl: null };
    const inferred = this.inferMetadata(book.title, book.author);
    if (inferred.title !== book.title || inferred.author !== book.author) {
      await this.prisma.book.update({
        where: { id: book.id }, data: { title: inferred.title, author: inferred.author },
      });
    }
    const cover = await this.covers.search(inferred.title, inferred.author);
    if (!cover) return { available: false, coverUrl: null };
    await this.prisma.book.update({
      where: { id: book.id },
      data: {
        coverData: cover.data ? Uint8Array.from(cover.data) : undefined,
        coverMimeType: cover.mimeType,
        coverUrl: cover.externalUrl,
      },
    });
    return { available: true, coverUrl: cover.externalUrl ?? null };
  }

  private inferMetadata(title: string, author?: string | null) {
    if (author) return { title, author };
    const parts = title.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return { title, author: undefined };
    const possibleAuthor = parts.at(-1)!;
    const looksLikeAuthor = possibleAuthor.split(/\s+/).length >= 2
      && !/edi[cç][aã]o|volume|vol\.?|completo|completa|livro/i.test(possibleAuthor);
    return looksLikeAuthor
      ? { title: parts.slice(0, -1).join(' - '), author: possibleAuthor }
      : { title, author: undefined };
  }

  async content(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: {
        id: true, title: true, author: true, fileType: true, processingStatus: true,
        processingError: true, wordCount: true,
        progress: true,
        sections: { orderBy: { position: 'asc' } },
      },
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
