import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantRequestDto } from './dto/assistant-request.dto';

type OpenAiResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

@Injectable()
export class ReaderAssistantService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async ask(userId: string, bookId: string, dto: AssistantRequestDto) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: {
        title: true,
        sections: {
          where: dto.sectionId ? { id: dto.sectionId } : undefined,
          orderBy: { position: 'asc' },
          take: dto.sectionId ? 1 : 3,
          select: { content: true },
        },
      },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');

    const excerpt = (dto.selectedText?.trim() || book.sections.map((section) => section.content).join('\n\n')).slice(0, 12_000);
    if (!excerpt) throw new BadRequestException('Selecione um trecho ou aguarde o processamento do livro');
    if (dto.action === 'question' && !dto.question?.trim()) throw new BadRequestException('Escreva uma pergunta');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('O assistente ainda não foi configurado. Defina OPENAI_API_KEY no backend.');

    const requests = {
      summarize: 'Resuma o trecho com clareza, preservando as ideias essenciais.',
      explain: 'Explique o trecho em linguagem simples, incluindo conceitos que podem causar dúvida.',
      context: 'Apresente o contexto e os temas do trecho sem inventar fatos que não estejam sustentados pelo texto.',
      question: `Responda à pergunta com base somente no trecho. Pergunta: ${dto.question?.trim()}`,
    };
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5-mini',
        store: false,
        max_output_tokens: 800,
        instructions: 'Você é um assistente de leitura. Responda em português brasileiro, de forma concisa e fiel ao texto fornecido.',
        input: `Livro: ${book.title}\n\nTarefa: ${requests[dto.action]}\n\nTrecho:\n${excerpt}`,
      }),
    });
    const result = await response.json() as OpenAiResponse;
    if (!response.ok) throw new BadGatewayException(result.error?.message ?? 'Não foi possível consultar o assistente');
    const answer = result.output?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === 'output_text')
      .map((content) => content.text ?? '').join('\n').trim();
    if (!answer) throw new BadGatewayException('O assistente não retornou uma resposta');
    return { answer };
  }
}
