import { BadRequestException, Injectable } from '@nestjs/common';
import { createCanvas } from '@napi-rs/canvas';
import { convert } from 'html-to-text';
import JSZip = require('jszip');
import type { Worker as OcrWorker } from 'tesseract.js';
import { PrismaService } from '../prisma/prisma.service';
import { DriveService } from './drive.service';

type ExtractedSection = { title?: string; content: string; wordCount: number };

@Injectable()
export class BookProcessingService {
  constructor(private readonly drive: DriveService, private readonly prisma: PrismaService) {}

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
      const sections = book.fileType === 'epub' ? await this.extractEpub(file.data) : await this.extractPdf(file.data);
      if (!sections.length) {
        throw new BadRequestException(book.fileType === 'pdf'
          ? 'Não foi possível reconhecer texto no PDF, mesmo após OCR.'
          : 'O EPUB não contém conteúdo de leitura reconhecível.');
      }
      const wordCount = sections.reduce((total, section) => total + section.wordCount, 0);
      await this.prisma.$transaction([
        this.prisma.bookSection.deleteMany({ where: { bookId: book.id } }),
        this.prisma.bookSection.createMany({
          data: sections.map((section, position) => ({ ...section, position, bookId: book.id })),
        }),
        this.prisma.book.update({
          where: { id: book.id }, data: { processingStatus: 'READY', processingError: null, wordCount },
        }),
      ]);
      return { bookId: book.id, sections: sections.length, wordCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo';
      await this.prisma.book.update({ where: { id: book.id }, data: { processingError: message.slice(0, 500) } });
      throw error;
    }
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
    let ocrWorker: OcrWorker | undefined;
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        let content = this.normalizeText(text.items
          .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
          .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`).join(''));
        if (content.length < Number(process.env.OCR_MIN_TEXT_LENGTH ?? 30)) {
          ocrWorker ??= await this.createOcrWorker();
          content = await this.ocrPage(page, ocrWorker);
        }
        if (content) sections.push(this.section(`Página ${pageNumber}`, content));
        page.cleanup();
      }
    } finally {
      await ocrWorker?.terminate();
      await loadingTask.destroy();
    }
    return sections;
  }

  private async createOcrWorker() {
    const { createWorker } = await import('tesseract.js');
    const portugueseData = require('@tesseract.js-data/por') as { langPath: string };
    return createWorker('por', undefined, {
      langPath: portugueseData.langPath, gzip: true, cacheMethod: 'readOnly', logger: () => undefined,
    });
  }

  private async ocrPage(page: any, worker: OcrWorker) {
    const viewport = page.getViewport({ scale: Number(process.env.OCR_RENDER_SCALE ?? 2) });
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
      if (content) sections.push(this.section(title ? this.normalizeText(convert(title)) : undefined, content));
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

  private section(title: string | undefined, content: string): ExtractedSection {
    return { title, content, wordCount: content.split(/\s+/u).filter(Boolean).length };
  }
}
