import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import portugueseData from '@tesseract.js-data/por';
import { convert } from 'html-to-text';
import JSZip from 'jszip';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { Worker as OcrWorker } from 'tesseract.js';
import { PrismaService } from '../prisma/prisma.service';
import { DriveService } from './drive.service';
import { BookCoverService } from '../books/book-cover.service';
import { BookIntelligenceService } from './book-intelligence.service';

type ExtractionMethod = 'pdf' | 'ocr' | 'epub';
type ExtractedSection = {
  title?: string;
  content: string;
  wordCount: number;
  extractionMethod: ExtractionMethod;
  extractionQuality?: number;
};
type BookMetadata = { title?: string; author?: string };

const PORTUGUESE_COMMON_WORDS = new Set([
  'a', 'ao', 'aos', 'aquela', 'aquele', 'aqueles', 'as', 'até', 'com', 'como', 'da', 'das', 'de', 'dela',
  'dele', 'deles', 'depois', 'do', 'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'essa',
  'esse', 'esta', 'este', 'eu', 'foi', 'há', 'isso', 'já', 'lhe', 'mais', 'mas', 'me', 'mesmo', 'meu',
  'minha', 'muito', 'na', 'não', 'nas', 'nem', 'no', 'nos', 'nós', 'num', 'numa', 'o', 'onde', 'ou',
  'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'porque', 'quando', 'que', 'quem', 'se', 'sem', 'seu',
  'sua', 'também', 'tem', 'tinha', 'todo', 'todos', 'um', 'uma', 'você', 'à', 'às', 'é', 'são',
]);

export type TextQualityAssessment = {
  score: number;
  lowQuality: boolean;
  reasons: string[];
  metrics: {
    wordCount: number;
    letterRatio: number;
    plausibleWordRatio: number;
    portugueseWordRatio: number;
    uppercaseWordRatio: number;
    unusualCharacterRatio: number;
    replacementCharacterRatio: number;
    veryLongWordRatio: number;
    improbableWordRatio: number;
    fragmentedWordRatio: number;
  };
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function ratio(part: number, total: number) {
  return total ? part / total : 0;
}

export function evaluateExtractedText(
  content: string,
  minimumLength = 30,
  qualityThreshold = 0.58,
): TextQualityAssessment {
  const compact = content.replace(/\s/gu, '');
  const words = content.match(/\p{L}+(?:[’'-]\p{L}+)*/gu) ?? [];
  const comparableWords = words.filter((word) => word.length > 2);
  const normalizedWords = words.map((word) => word.toLocaleLowerCase('pt-BR'));
  const letters = compact.match(/\p{L}/gu)?.length ?? 0;
  const replacements = content.match(/\uFFFD/gu)?.length ?? 0;
  const unusual = compact.match(/[^\p{L}\p{N}.,;:!?"'“”‘’(){}\[\]…—–\-_/\\@%+*=<>ºª°§€$£¥#&]/gu)?.length ?? 0;
  const veryLongWords = words.filter((word) => word.length > 30).length;
  const improbableWords = normalizedWords.filter((word) => {
    const ascii = word.normalize('NFD').replace(/\p{M}/gu, '');
    return word.length > 30
      || /(.)\1{3,}/u.test(ascii)
      || /[bcdfghjklmnpqrstvwxyz]{6,}/u.test(ascii)
      || (word.length > 4 && !/[aeiou]/u.test(ascii));
  }).length;
  const plausibleWords = normalizedWords.filter((word) => {
    const ascii = word.normalize('NFD').replace(/\p{M}/gu, '');
    return word.length <= 30
      && !/(.)\1{3,}/u.test(ascii)
      && !/[bcdfghjklmnpqrstvwxyz]{6,}/u.test(ascii)
      && (word.length <= 2 || /[aeiou]/u.test(ascii));
  }).length;
  const recognizedPortugueseWords = normalizedWords.filter((word) => PORTUGUESE_COMMON_WORDS.has(word)).length;
  const uppercaseWords = comparableWords.filter((word) => word === word.toLocaleUpperCase('pt-BR')).length;
  const fragmentedWords = words.filter((word) => word.length === 1 && !/[aeoàéó]/iu.test(word)).length;

  const metrics = {
    wordCount: words.length,
    letterRatio: ratio(letters, compact.length),
    plausibleWordRatio: ratio(plausibleWords, words.length),
    portugueseWordRatio: ratio(recognizedPortugueseWords, words.length),
    uppercaseWordRatio: ratio(uppercaseWords, comparableWords.length),
    unusualCharacterRatio: ratio(unusual, compact.length),
    replacementCharacterRatio: ratio(replacements, compact.length),
    veryLongWordRatio: ratio(veryLongWords, words.length),
    improbableWordRatio: ratio(improbableWords, words.length),
    fragmentedWordRatio: ratio(fragmentedWords, words.length),
  };

  let score = 1;
  score -= clamp((0.7 - metrics.letterRatio) / 0.7) * 0.24;
  score -= clamp((0.72 - metrics.plausibleWordRatio) / 0.72) * 0.24;
  score -= clamp((metrics.uppercaseWordRatio - 0.5) / 0.5) * 0.08;
  score -= clamp(metrics.unusualCharacterRatio / 0.08) * 0.18;
  score -= clamp(metrics.replacementCharacterRatio / 0.01) * 0.2;
  score -= clamp(metrics.veryLongWordRatio / 0.08) * 0.14;
  score -= clamp(metrics.improbableWordRatio / 0.18) * 0.2;
  score -= clamp((metrics.fragmentedWordRatio - 0.2) / 0.5) * 0.14;
  if (words.length >= 20) score -= clamp((0.06 - metrics.portugueseWordRatio) / 0.06) * 0.16;
  score = Number(clamp(score).toFixed(3));

  const reasons: string[] = [];
  if (content.length < minimumLength) reasons.push('texto curto');
  if (metrics.letterRatio < 0.55) reasons.push('baixa proporção de letras');
  if (words.length >= 8 && metrics.plausibleWordRatio < 0.55) reasons.push('poucas palavras plausíveis');
  if (words.length >= 12 && metrics.uppercaseWordRatio > 0.72) reasons.push('excesso de palavras em maiúsculas');
  if (replacements >= 3 || metrics.replacementCharacterRatio > 0.005) reasons.push('caracteres de substituição');
  if (metrics.unusualCharacterRatio > 0.06) reasons.push('símbolos incomuns em excesso');
  if (metrics.veryLongWordRatio > 0.06) reasons.push('palavras excessivamente longas');
  if (metrics.improbableWordRatio > 0.15) reasons.push('sequências de letras improváveis');
  if (words.length >= 20 && metrics.portugueseWordRatio < 0.025) reasons.push('poucas palavras reconhecíveis em português');
  if (words.length >= 20 && metrics.fragmentedWordRatio > 0.45) reasons.push('texto excessivamente fragmentado');

  const hardFailure = replacements >= 3
    || metrics.unusualCharacterRatio > 0.12
    || (words.length >= 10 && metrics.plausibleWordRatio < 0.4)
    || (words.length >= 60 && metrics.portugueseWordRatio < 0.01)
    || (words.length >= 20 && metrics.improbableWordRatio > 0.25)
    || (words.length >= 20 && metrics.fragmentedWordRatio > 0.6);
  return {
    score,
    lowQuality: content.length < minimumLength || score < qualityThreshold || hardFailure,
    reasons,
    metrics,
  };
}

@Injectable()
export class BookProcessingService {
  private readonly logger = new Logger(BookProcessingService.name);
  constructor(
    private readonly drive: DriveService,
    private readonly prisma: PrismaService,
    private readonly covers: BookCoverService,
    private readonly intelligence: BookIntelligenceService,
  ) {}

  async prepareImport(userId: string, fileId: string) {
    const metadata = await this.drive.getFileMetadata(userId, fileId);
    const fileType = this.fileType(metadata.mimeType, metadata.name);
    const maxBytes = Number(process.env.MAX_IMPORT_FILE_SIZE_MB ?? 50) * 1024 * 1024;
    if (metadata.size && Number(metadata.size) > maxBytes) {
      throw new BadRequestException(`O arquivo excede o limite de ${process.env.MAX_IMPORT_FILE_SIZE_MB ?? 50} MB`);
    }
    const existing = await this.prisma.book.findFirst({ where: { userId, sourceFileId: fileId } });
    const book = existing ?? await this.prisma.book.create({
      data: {
        userId, sourceFileId: fileId, title: metadata.name.replace(/\.(pdf|epub)$/i, ''), fileType,
        fileUrl: `/api/drive/files/${encodeURIComponent(fileId)}/content`,
      },
    });
    return this.prisma.book.update({
      where: { id: book.id }, data: { processingStatus: 'PENDING', processingError: null },
    });
  }

  async process(userId: string, fileId: string, bookId: string) {
    const book = await this.prisma.book.findFirstOrThrow({ where: { id: bookId, userId, sourceFileId: fileId } });
    await this.prisma.book.update({
      where: { id: book.id }, data: { processingStatus: 'PROCESSING', processingError: null },
    });
    try {
      const file = await this.drive.downloadFile(userId, fileId);
      return await this.extractAndPersist(userId, book.id, book.fileType, file.data, book.title, book.author);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo';
      await this.prisma.book.update({ where: { id: book.id }, data: { processingError: message.slice(0, 500) } });
      throw error;
    }
  }

  async importUpload(userId: string, filename: string, mimeType: string, data: Buffer) {
    const fileType = this.fileType(mimeType, filename);
    const maxBytes = Number(process.env.MAX_IMPORT_FILE_SIZE_MB ?? 50) * 1024 * 1024;
    if (data.length > maxBytes) throw new BadRequestException(`O arquivo excede o limite de ${process.env.MAX_IMPORT_FILE_SIZE_MB ?? 50} MB`);
    const book = await this.prisma.book.create({
      data: {
        userId,
        title: filename.replace(/\.(pdf|epub)$/i, ''),
        fileType,
        fileUrl: `upload://${encodeURIComponent(filename)}`,
        processingStatus: 'PROCESSING',
      },
    });
    try {
      await this.extractAndPersist(userId, book.id, fileType, data, book.title, book.author);
      return this.prisma.book.findUniqueOrThrow({ where: { id: book.id }, include: { progress: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo';
      await this.markFailed(book.id, message);
      throw error;
    }
  }

  private async extractAndPersist(userId: string, bookId: string, fileType: string, data: Buffer, title: string, author?: string | null) {
    const metadata = fileType === 'epub' ? await this.extractEpubMetadata(data) : await this.extractPdfMetadata(data);
    const extractedMetadata = { title: metadata.title || title, author: metadata.author || author || undefined };
    const extractedSections = fileType === 'epub' ? await this.extractEpub(data) : await this.extractPdf(data);
    const prepared = await this.intelligence.prepare(userId, title, fileType, extractedMetadata, extractedSections);
    const resolvedTitle = prepared.metadata.title || extractedMetadata.title || title;
    const resolvedAuthor = prepared.metadata.author || extractedMetadata.author;
    const sections = prepared.sections;
    if (!sections.length) {
      throw new BadRequestException(fileType === 'pdf'
        ? 'Não foi possível reconhecer texto no PDF, mesmo após OCR.'
        : 'O EPUB não contém conteúdo de leitura reconhecível.');
    }
    const wordCount = sections.reduce((total, section) => total + section.wordCount, 0);
    const cover = await this.covers.resolve(fileType, data, resolvedTitle, resolvedAuthor);
    await this.prisma.$transaction([
      this.prisma.bookSection.deleteMany({ where: { bookId } }),
      this.prisma.bookSection.createMany({
        data: sections.map((section, position) => ({ ...section, position, bookId })),
      }),
      this.prisma.book.update({
        where: { id: bookId }, data: {
          processingStatus: 'READY', processingError: null, wordCount,
          title: resolvedTitle,
          author: resolvedAuthor,
          contentReviewedByAi: prepared.reviewedByAi,
          removedSectionCount: prepared.removedSectionCount,
          coverData: cover?.data ? Uint8Array.from(cover.data) : undefined,
          coverMimeType: cover?.mimeType,
          coverUrl: cover?.externalUrl,
        },
      }),
    ]);
    return { bookId, sections: sections.length, wordCount };
  }

  private async extractPdfMetadata(data: Buffer): Promise<BookMetadata> {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = pdfjs.getDocument({ data: new Uint8Array(data), useWorkerFetch: false });
      const document = await task.promise;
      try {
        const metadata = await document.getMetadata();
        const info = metadata.info as Record<string, unknown>;
        return {
          title: this.cleanMetadata(info.Title),
          author: this.cleanMetadata(info.Author),
        };
      } finally { await task.destroy(); }
    } catch { return {}; }
  }

  private async extractEpubMetadata(data: Buffer): Promise<BookMetadata> {
    try {
      const zip = await JSZip.loadAsync(data);
      const container = await zip.file('META-INF/container.xml')?.async('string');
      const opfPath = container?.match(/full-path=["']([^"']+)["']/i)?.[1];
      const opf = opfPath ? await zip.file(opfPath)?.async('string') : undefined;
      if (!opf) return {};
      return {
        title: this.cleanMetadata(opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]),
        author: this.cleanMetadata(opf.match(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]),
      };
    } catch { return {}; }
  }

  private cleanMetadata(value: unknown) {
    if (typeof value !== 'string') return undefined;
    const cleaned = this.normalizeText(convert(value, { wordwrap: false }));
    return cleaned || undefined;
  }

  async markFailed(bookId: string, message: string) {
    await this.prisma.book.updateMany({
      where: { id: bookId, processingStatus: { not: 'READY' } },
      data: { processingStatus: 'FAILED', processingError: message.slice(0, 500) },
    });
  }

  private fileType(mimeType: string, name: string): 'pdf' | 'epub' {
    if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (mimeType === 'application/epub+zip' || name.toLowerCase().endsWith('.epub')) return 'epub';
    throw new BadRequestException('Apenas arquivos PDF e EPUB podem ser importados');
  }

  private async extractPdf(data: Buffer): Promise<ExtractedSection[]> {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data), useWorkerFetch: false });
    const document = await loadingTask.promise;
    const sections: ExtractedSection[] = [];
    const configuredMinimumLength = Number(process.env.OCR_MIN_TEXT_LENGTH ?? 30);
    const configuredQualityThreshold = Number(process.env.OCR_MIN_TEXT_QUALITY ?? 0.58);
    const minimumLength = Number.isFinite(configuredMinimumLength) ? Math.max(0, configuredMinimumLength) : 30;
    const qualityThreshold = Number.isFinite(configuredQualityThreshold) ? clamp(configuredQualityThreshold) : 0.58;
    let ocrWorker: OcrWorker | undefined;
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        const pdfContent = this.normalizeText(text.items
          .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
          .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`).join(''));
        const pdfQuality = evaluateExtractedText(pdfContent, minimumLength, qualityThreshold);
        let content = pdfContent;
        let extractionMethod: ExtractionMethod = 'pdf';
        let extractionQuality = pdfQuality.score;

        if (pdfQuality.lowQuality) {
          this.logger.debug(`OCR acionado na página ${pageNumber}: ${pdfQuality.reasons.join(', ') || `qualidade ${pdfQuality.score}`}`);
          ocrWorker ??= await this.createOcrWorker();
          const ocrContent = await this.ocrPage(page, ocrWorker);
          if (ocrContent) {
            const ocrQuality = evaluateExtractedText(ocrContent, minimumLength, qualityThreshold);
            content = ocrContent;
            extractionMethod = 'ocr';
            extractionQuality = ocrQuality.score;
          }
        }
        if (content) sections.push(this.section(`Página ${pageNumber}`, content, extractionMethod, extractionQuality));
        page.cleanup();
      }
    } finally {
      await ocrWorker?.terminate();
      await loadingTask.destroy();
    }
    return sections;
  }

  private async createOcrWorker() {
    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('por', undefined, {
      langPath: portugueseData.langPath, gzip: true, cacheMethod: 'readOnly', logger: () => undefined,
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });
    return worker;
  }

  private async ocrPage(page: PDFPageProxy, worker: OcrWorker) {
    const configuredScale = Number(process.env.OCR_RENDER_SCALE ?? 2.5);
    const scale = clamp(Number.isFinite(configuredScale) ? configuredScale : 2.5, 1.5, 4);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as never, canvasContext: canvas.getContext('2d') as never, viewport }).promise;
    const result = await worker.recognize(canvas.toBuffer('image/png'));
    return this.normalizeText(result.data.text);
  }

  private async extractEpub(data: Buffer): Promise<ExtractedSection[]> {
    const zip = await JSZip.loadAsync(data);
    const container = await zip.file('META-INF/container.xml')?.async('string');
    const opfPath = container?.match(/full-path=["']([^"']+)["']/i)?.[1];
    if (!opfPath) throw new BadRequestException('EPUB inválido: manifesto não encontrado');
    const opf = await zip.file(opfPath)?.async('string');
    if (!opf) throw new BadRequestException('EPUB inválido: pacote não encontrado');
    const manifest = new Map<string, string>();
    for (const match of opf.matchAll(/<item\b[^>]*\bid=["']([^"']+)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
      manifest.set(match[1], match[2]);
    }
    const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const sections: ExtractedSection[] = [];
    for (const match of opf.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*>/gi)) {
      const href = manifest.get(match[1]);
      if (!href) continue;
      const path = this.resolveZipPath(base, decodeURIComponent(href.split('#')[0]));
      const html = await zip.file(path)?.async('string');
      if (!html) continue;
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
      const content = this.normalizeText(convert(html, {
        wordwrap: false,
        selectors: [{ selector: 'img', format: 'skip' }, { selector: 'a', options: { ignoreHref: true } }],
      }));
      if (content) sections.push(this.section(title ? this.normalizeText(convert(title)) : undefined, content, 'epub'));
    }
    return sections;
  }

  private resolveZipPath(base: string, href: string) {
    const parts = `${base}${href}`.replace(/\\/g, '/').split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') resolved.pop(); else resolved.push(part);
    }
    return resolved.join('/');
  }

  private normalizeText(value: string) {
    return value.replace(/\r\n?/g, '\n').replace(/[\t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private section(
    title: string | undefined,
    content: string,
    extractionMethod: ExtractionMethod,
    extractionQuality?: number,
  ): ExtractedSection {
    return { title, content, wordCount: content.split(/\s+/u).filter(Boolean).length, extractionMethod, extractionQuality };
  }
}
