import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderMarksService } from './reader-marks.service';

describe('ReaderMarksService', () => {
  const prisma = {
    bookSection: { findFirst: jest.fn() },
    highlight: { findMany: jest.fn(), create: jest.fn() },
  };
  const service = new ReaderMarksService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('reconstrói o texto marcado a partir da seção persistida', async () => {
    prisma.bookSection.findFirst.mockResolvedValue({ id: 'section-1', content: 'A leitura transforma pessoas.' });
    prisma.highlight.findMany.mockResolvedValue([]);
    prisma.highlight.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({
      id: 'highlight-1',
      cfiRange: data.cfiRange,
      text: data.text,
      color: data.color,
      createdAt: new Date('2026-08-28T00:00:00Z'),
      annotation: { id: 'note-1', content: 'Rever este conceito', updatedAt: new Date('2026-08-28T00:00:00Z') },
    }));

    const result = await service.create('user-1', 'book-1', {
      sectionId: 'section-1', start: 2, end: 9, color: 'yellow', note: 'Rever este conceito',
    });

    expect(result.text).toBe('leitura');
    expect(result.range).toEqual({ sectionId: 'section-1', start: 2, end: 9 });
    expect(prisma.highlight.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ text: 'leitura', bookId: 'book-1', color: 'yellow' }),
    }));
  });

  it('impede marcações sobrepostas na mesma seção', async () => {
    prisma.bookSection.findFirst.mockResolvedValue({ id: 'section-1', content: 'Texto suficiente para duas marcações.' });
    prisma.highlight.findMany.mockResolvedValue([
      { cfiRange: JSON.stringify({ sectionId: 'section-1', start: 3, end: 12 }) },
    ]);

    await expect(service.create('user-1', 'book-1', {
      sectionId: 'section-1', start: 8, end: 18, color: 'blue',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('não permite marcar uma seção fora do livro do usuário', async () => {
    prisma.bookSection.findFirst.mockResolvedValue(null);

    await expect(service.create('user-1', 'book-1', {
      sectionId: 'section-other', start: 0, end: 5, color: 'green',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
