import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlight.dto';

type StoredRange = { sectionId: string; start: number; end: number };
type HighlightWithAnnotation = {
  id: string;
  cfiRange: string;
  text: string;
  color: string;
  createdAt: Date;
  annotation: { id: string; content: string; updatedAt: Date } | null;
};

@Injectable()
export class ReaderMarksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, bookId: string) {
    await this.requireBook(userId, bookId);
    const highlights = await this.prisma.highlight.findMany({
      where: { bookId },
      include: { annotation: { select: { id: true, content: true, updatedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return highlights.flatMap((highlight) => {
      const range = this.parseRange(highlight.cfiRange);
      return range ? [this.serialize(highlight, range)] : [];
    });
  }

  async create(userId: string, bookId: string, dto: CreateHighlightDto) {
    const section = await this.prisma.bookSection.findFirst({
      where: { id: dto.sectionId, bookId, book: { userId } },
      select: { id: true, content: true },
    });
    if (!section) throw new NotFoundException('Seção não encontrada');
    if (dto.start >= dto.end || dto.end > section.content.length) {
      throw new BadRequestException('O intervalo selecionado é inválido');
    }
    const text = section.content.slice(dto.start, dto.end);
    if (!text.trim()) throw new BadRequestException('Selecione um trecho com texto');

    const existing = await this.prisma.highlight.findMany({ where: { bookId }, select: { cfiRange: true } });
    const overlaps = existing.some(({ cfiRange }) => {
      const range = this.parseRange(cfiRange);
      return range?.sectionId === section.id && dto.start < range.end && dto.end > range.start;
    });
    if (overlaps) throw new BadRequestException('Este trecho já possui uma marcação');

    const range: StoredRange = { sectionId: section.id, start: dto.start, end: dto.end };
    const note = dto.note?.trim();
    const highlight = await this.prisma.highlight.create({
      data: {
        bookId,
        cfiRange: JSON.stringify(range),
        text,
        color: dto.color,
        annotation: note ? { create: { bookId, cfiRange: JSON.stringify(range), content: note } } : undefined,
      },
      include: { annotation: { select: { id: true, content: true, updatedAt: true } } },
    });
    return this.serialize(highlight, range);
  }

  async update(userId: string, bookId: string, highlightId: string, dto: UpdateHighlightDto) {
    const current = await this.requireHighlight(userId, bookId, highlightId);
    const note = dto.note?.trim();
    const highlight = await this.prisma.$transaction(async (transaction) => {
      if (dto.note !== undefined) {
        if (note) {
          await transaction.annotation.upsert({
            where: { highlightId },
            create: { bookId, highlightId, cfiRange: current.cfiRange, content: note },
            update: { content: note },
          });
        } else {
          await transaction.annotation.deleteMany({ where: { highlightId, bookId } });
        }
      }
      return transaction.highlight.update({
        where: { id: highlightId },
        data: { color: dto.color },
        include: { annotation: { select: { id: true, content: true, updatedAt: true } } },
      });
    });
    return this.serialize(highlight, this.parseRange(current.cfiRange)!);
  }

  async remove(userId: string, bookId: string, highlightId: string) {
    await this.requireHighlight(userId, bookId, highlightId);
    await this.prisma.highlight.delete({ where: { id: highlightId } });
  }

  private async requireBook(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({ where: { id: bookId, userId }, select: { id: true } });
    if (!book) throw new NotFoundException('Livro não encontrado');
    return book;
  }

  private async requireHighlight(userId: string, bookId: string, highlightId: string) {
    const highlight = await this.prisma.highlight.findFirst({
      where: { id: highlightId, bookId, book: { userId } },
      select: { id: true, cfiRange: true },
    });
    if (!highlight) throw new NotFoundException('Marcação não encontrada');
    return highlight;
  }

  private parseRange(value: string): StoredRange | null {
    try {
      const parsed = JSON.parse(value) as Partial<StoredRange>;
      const start = parsed.start;
      const end = parsed.end;
      return typeof parsed.sectionId === 'string'
        && typeof start === 'number' && typeof end === 'number'
        && Number.isInteger(start) && Number.isInteger(end)
        && start >= 0 && end > start
        ? { sectionId: parsed.sectionId, start, end }
        : null;
    } catch { return null; }
  }

  private serialize(highlight: HighlightWithAnnotation, range: StoredRange) {
    return {
      id: highlight.id,
      text: highlight.text,
      color: highlight.color,
      range,
      createdAt: highlight.createdAt,
      annotation: highlight.annotation,
    };
  }
}
