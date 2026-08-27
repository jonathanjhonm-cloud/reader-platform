import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

export type ReadingSection = { title?: string; content: string; wordCount: number };
export type ReadingMetadata = { title?: string; author?: string };

type OpenAiResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type MetadataReview = { title: string | null; author: string | null };
type SectionReview = { excludedPositions: number[] };

@Injectable()
export class BookIntelligenceService {
  private readonly logger = new Logger(BookIntelligenceService.name);

  constructor(private readonly config: ConfigService) {}

  async prepare(
    userId: string,
    filename: string,
    fileType: string,
    metadata: ReadingMetadata,
    sections: ReadingSection[],
  ) {
    const normalized = sections
      .map((section) => this.normalizeSection(section, fileType === 'pdf'))
      .filter((section) => section.content.length > 0);
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const enabled = this.config.get<string>('AI_BOOK_PROCESSING_ENABLED') !== 'false';

    if (!apiKey || !enabled) {
      return { metadata, sections: normalized, reviewedByAi: false, removedSectionCount: sections.length - normalized.length };
    }

    try {
      const enhancedMetadata = await this.reviewMetadata(userId, filename, metadata, normalized, apiKey);
      const suspicious = normalized
        .map((section, position) => ({ section, position }))
        .filter(({ section }) => this.isSuspicious(section));
      const excluded = suspicious.length
        ? await this.reviewSuspiciousSections(userId, suspicious, apiKey)
        : new Set<number>();
      const cleaned = normalized.filter((_, position) => !excluded.has(position));

      // Nunca permita que uma revisão remota apague o livro inteiro.
      const safeSections = cleaned.length ? cleaned : normalized;
      return {
        metadata: enhancedMetadata,
        sections: safeSections,
        reviewedByAi: true,
        removedSectionCount: sections.length - safeSections.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.warn(`Revisão por IA ignorada: ${message}`);
      return { metadata, sections: normalized, reviewedByAi: false, removedSectionCount: sections.length - normalized.length };
    }
  }

  private async reviewMetadata(
    userId: string,
    filename: string,
    metadata: ReadingMetadata,
    sections: ReadingSection[],
    apiKey: string,
  ): Promise<ReadingMetadata> {
    const excerpt = sections.slice(0, 6).map((section) =>
      `${section.title ? `${section.title}\n` : ''}${section.content.slice(0, 2_500)}`,
    ).join('\n\n---\n\n').slice(0, 14_000);
    const result = await this.structuredRequest<MetadataReview>({
      userId,
      apiKey,
      name: 'book_metadata',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: ['string', 'null'] },
          author: { type: ['string', 'null'] },
        },
        required: ['title', 'author'],
      },
      instructions: [
        'Você revisa metadados de livros sem inventar informações.',
        'Use somente o nome do arquivo, os metadados extraídos e o trecho fornecido.',
        'Corrija ruído técnico e capitalização. Retorne null quando título ou autor não puderem ser confirmados.',
        'Não trate editora, tradutor, coleção, nome de arquivo ou cabeçalho de site como autor.',
      ].join(' '),
      input: `Arquivo: ${filename}\nTítulo extraído: ${metadata.title ?? 'não encontrado'}\nAutor extraído: ${metadata.author ?? 'não encontrado'}\n\nInício do conteúdo:\n${excerpt}`,
      maxOutputTokens: 300,
    });
    return {
      title: this.cleanMetadata(result.title) ?? metadata.title,
      author: this.cleanMetadata(result.author) ?? metadata.author,
    };
  }

  private async reviewSuspiciousSections(
    userId: string,
    candidates: Array<{ section: ReadingSection; position: number }>,
    apiKey: string,
  ) {
    const excluded = new Set<number>();
    for (let offset = 0; offset < candidates.length; offset += 12) {
      const batch = candidates.slice(offset, offset + 12);
      const input = batch.map(({ section, position }) => ({
        position,
        title: section.title ?? null,
        wordCount: section.wordCount,
        content: section.content.slice(0, 1_800),
      }));
      const review = await this.structuredRequest<SectionReview>({
        userId,
        apiKey,
        name: 'section_quality_review',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            excludedPositions: { type: 'array', items: { type: 'integer' } },
          },
          required: ['excludedPositions'],
        },
        instructions: [
          'Você faz uma revisão conservadora de texto extraído de livros.',
          'Exclua somente posições claramente ilegíveis, vazias, compostas por artefatos de OCR ou sem conteúdo textual útil.',
          'Não exclua capa textual, dedicatória, sumário, notas, páginas curtas, poemas ou conteúdo válido apenas por serem breves.',
          'Retorne exclusivamente posições presentes na entrada.',
        ].join(' '),
        input: JSON.stringify(input),
        maxOutputTokens: 300,
      });
      const allowed = new Set(batch.map((item) => item.position));
      review.excludedPositions.filter((position) => allowed.has(position)).forEach((position) => excluded.add(position));
    }
    return excluded;
  }

  private async structuredRequest<T>({
    userId, apiKey, name, schema, instructions, input, maxOutputTokens,
  }: {
    userId: string;
    apiKey: string;
    name: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
    maxOutputTokens: number;
  }): Promise<T> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.get<string>('OPENAI_PROCESSING_MODEL')
          ?? this.config.get<string>('OPENAI_MODEL')
          ?? 'gpt-5-mini',
        store: false,
        max_output_tokens: maxOutputTokens,
        safety_identifier: createHash('sha256').update(userId).digest('hex'),
        instructions,
        input,
        text: { format: { type: 'json_schema', name, strict: true, schema } },
      }),
    });
    const result = await response.json() as OpenAiResponse;
    if (!response.ok) throw new Error(result.error?.message ?? `OpenAI respondeu com status ${response.status}`);
    const output = result.output?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === 'output_text')?.text;
    if (!output) throw new Error('A IA não retornou uma análise estruturada');
    return JSON.parse(output) as T;
  }

  private normalizeSection(section: ReadingSection, reflowLines: boolean): ReadingSection {
    let content = section.content
      .normalize('NFKC')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/(\p{L})-\n(?=\p{Ll})/gu, '$1')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (reflowLines) {
      // PDF costuma quebrar cada linha visual como se fosse um parágrafo; EPUB preserva sua estrutura original.
      content = content.split(/\n{2,}/).map((paragraph) => {
        const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.length < 2 || lines.some((line) => /^([•*-]|\d+[.)])\s/u.test(line))) return lines.join('\n');
        return lines.join(' ').replace(/\s{2,}/g, ' ');
      }).join('\n\n');
    }

    return { ...section, content, wordCount: this.wordCount(content) };
  }

  private isSuspicious(section: ReadingSection) {
    if (section.wordCount < 4) return true;
    const compact = section.content.replace(/\s/g, '');
    if (!compact) return true;
    const letters = compact.match(/\p{L}/gu)?.length ?? 0;
    const replacementCharacters = section.content.match(/[�]/g)?.length ?? 0;
    const veryLongTokens = section.content.split(/\s+/).filter((token) => token.length > 45).length;
    return letters / compact.length < 0.45
      || replacementCharacters >= 3
      || veryLongTokens >= Math.max(2, section.wordCount * 0.15);
  }

  private cleanMetadata(value: string | null) {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, 300) : undefined;
  }

  private wordCount(content: string) {
    return content.split(/\s+/u).filter(Boolean).length;
  }
}
