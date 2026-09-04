import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReaderAssistantService } from './reader-assistant.service';

describe('ReaderAssistantService', () => {
  const prisma = { book: { findFirst: jest.fn() } };
  const config = {
    get: jest.fn((key: string) => ({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' })[key]),
  };
  const service = new ReaderAssistantService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
  });

  it('resume a seção pertencente ao usuário e informa o escopo utilizado', async () => {
    prisma.book.findFirst.mockResolvedValue({
      title: 'Livro de teste',
      sections: [{ id: 'section-1', title: 'Capítulo 1', content: 'Uma ideia importante aparece neste trecho.' }],
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output_text: 'A seção apresenta uma ideia importante.' }),
    });

    const result = await service.ask('user-1', 'book-1', {
      action: 'summarize',
      sectionId: 'section-1',
    });

    expect(result).toEqual({ answer: 'A seção apresenta uma ideia importante.', scope: 'section' });
    expect(prisma.book.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'book-1', userId: 'user-1' },
    }));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'test-model', store: false, max_output_tokens: 1_000 });
    expect(body).toHaveProperty('safety_identifier');
    expect(body.input).toContain('Uma ideia importante');
  });

  it('usa somente um trecho válido da seção ao responder uma pergunta', async () => {
    prisma.book.findFirst.mockResolvedValue({
      title: 'Livro de teste',
      sections: [{ id: 'section-1', title: null, content: 'Primeiro parágrafo. Segundo parágrafo.' }],
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: [{ content: [{ type: 'output_text', text: 'A resposta está no segundo parágrafo.' }] }],
      }),
    });

    const result = await service.ask('user-1', 'book-1', {
      action: 'question',
      sectionId: 'section-1',
      selectedText: 'Segundo parágrafo.',
      question: 'Onde está a resposta?',
    });

    expect(result.scope).toBe('selection');
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string) as { input: string };
    expect(body.input).toContain('Pergunta do leitor: Onde está a resposta?');
    expect(body.input).toContain('<texto_referencia>\nSegundo parágrafo.\n</texto_referencia>');
    expect(body.input).not.toContain('Primeiro parágrafo.');
  });

  it('rejeita um trecho que não pertence à seção informada', async () => {
    prisma.book.findFirst.mockResolvedValue({
      title: 'Livro de teste',
      sections: [{ id: 'section-1', title: null, content: 'Conteúdo original da seção.' }],
    });

    await expect(service.ask('user-1', 'book-1', {
      action: 'explain',
      sectionId: 'section-1',
      selectedText: 'Texto enviado de outra origem.',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não permite consultar livros ou seções fora do escopo do usuário', async () => {
    prisma.book.findFirst.mockResolvedValueOnce(null);
    await expect(service.ask('user-1', 'book-other', { action: 'context' }))
      .rejects.toBeInstanceOf(NotFoundException);

    prisma.book.findFirst.mockResolvedValueOnce({ title: 'Livro', sections: [] });
    await expect(service.ask('user-1', 'book-1', { action: 'context', sectionId: 'section-other' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
