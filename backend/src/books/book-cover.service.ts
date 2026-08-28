import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';

type Cover = { data?: Buffer; mimeType?: string; externalUrl?: string };
type OpenLibraryResult = { docs?: Array<{ cover_i?: number }> };

@Injectable()
export class BookCoverService {
  private searchQueue: Promise<void> = Promise.resolve();
  private lastSearchAt = 0;

  constructor(private readonly config: ConfigService) {}

  async resolve(fileType: string, file: Buffer, title: string, author?: string | null): Promise<Cover | null> {
    const embedded = fileType === 'epub' ? await this.fromEpub(file) : await this.fromPdf(file);
    return embedded ?? this.search(title, author);
  }

  search(title: string, author?: string | null): Promise<Cover | null> {
    const result = this.searchQueue.then(async () => {
      const wait = Math.max(0, 1_050 - (Date.now() - this.lastSearchAt));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastSearchAt = Date.now();
      return this.fromOpenLibrary(title, author);
    });
    this.searchQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async fromEpub(data: Buffer): Promise<Cover | null> {
    try {
      const zip = await JSZip.loadAsync(data);
      const container = await zip.file('META-INF/container.xml')?.async('string');
      const opfPath = container?.match(/full-path=["']([^"']+)["']/i)?.[1];
      const opf = opfPath ? await zip.file(opfPath)?.async('string') : undefined;
      if (!opf || !opfPath) return null;
      const coverId = opf.match(/<meta\b[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i)?.[1];
      const items = [...opf.matchAll(/<item\b([^>]*)>/gi)].map((match) => this.attributes(match[1]));
      const coverItem = items.find((item) => item.properties?.split(/\s+/).includes('cover-image'))
        ?? items.find((item) => coverId && item.id === coverId)
        ?? items.find((item) => /cover/i.test(item.href ?? '') && item['media-type']?.startsWith('image/'));
      if (!coverItem?.href) return null;
      const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
      const path = this.resolveZipPath(base, decodeURIComponent(coverItem.href.split('#')[0]));
      const image = await zip.file(path)?.async('nodebuffer');
      const mimeType = coverItem['media-type'];
      return image && mimeType?.startsWith('image/') ? { data: image, mimeType } : null;
    } catch { return null; }
  }

  private async fromPdf(data: Buffer): Promise<Cover | null> {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = pdfjs.getDocument({ data: new Uint8Array(data), useWorkerFetch: false });
      const document = await task.promise;
      try {
        const page = await document.getPage(1);
        const viewport = page.getViewport({ scale: 0.8 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas: canvas as never, canvasContext: canvas.getContext('2d') as never, viewport }).promise;
        page.cleanup();
        return { data: canvas.toBuffer('image/jpeg'), mimeType: 'image/jpeg' };
      } finally { await task.destroy(); }
    } catch { return null; }
  }

  private async fromOpenLibrary(title: string, author?: string | null): Promise<Cover | null> {
    try {
      const normalizedTitle = title
        .replace(/\b(edi[cç][aã]o|complet\w*|comple\b|volume|vol\.?)\b/gi, ' ')
        .replace(/[\s-]+/g, ' ').trim();
      const query = new URLSearchParams({
        q: [normalizedTitle, author].filter(Boolean).join(' '), fields: 'cover_i', limit: '10', lang: 'pt',
      });
      const headers = { 'User-Agent': `LumenReader/0.1 (${this.config.get<string>('OPEN_LIBRARY_CONTACT_EMAIL') || 'personal reading app'})` };
      const search = await fetch(`https://openlibrary.org/search.json?${query}`, { headers, signal: AbortSignal.timeout(8_000) });
      if (!search.ok) return null;
      const result = await search.json() as OpenLibraryResult;
      const coverId = result.docs?.find((item) => item.cover_i)?.cover_i;
      if (!coverId) return null;
      const image = await fetch(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`, { headers, signal: AbortSignal.timeout(8_000) });
      const mimeType = image.headers.get('content-type')?.split(';')[0];
      const length = Number(image.headers.get('content-length') ?? 0);
      if (!image.ok || !mimeType?.startsWith('image/') || length > 5 * 1024 * 1024) return null;
      const data = Buffer.from(await image.arrayBuffer());
      return data.length <= 5 * 1024 * 1024 ? { data, mimeType } : null;
    } catch {
      try {
        const fallbackTitle = title
          .replace(/\b(edi[cç][aã]o|complet\w*|comple\b|volume|vol\.?)\b/gi, ' ')
          .replace(/[\s-]+/g, ' ').trim();
        const query = new URLSearchParams({
          q: [fallbackTitle, author].filter(Boolean).join(' '), fields: 'cover_i', limit: '10', lang: 'pt',
        });
        const response = await fetch(`https://openlibrary.org/search.json?${query}`, { signal: AbortSignal.timeout(8_000) });
        const result = response.ok ? await response.json() as OpenLibraryResult : undefined;
        const coverId = result?.docs?.find((item) => item.cover_i)?.cover_i;
        return coverId ? { externalUrl: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false` } : null;
      } catch { return null; }
    }
  }

  private attributes(value: string) {
    return Object.fromEntries([...value.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map((match) => [match[1], match[2]]));
  }

  private resolveZipPath(base: string, href: string) {
    const resolved: string[] = [];
    for (const part of `${base}${href}`.replace(/\\/g, '/').split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') resolved.pop(); else resolved.push(part);
    }
    return resolved.join('/');
  }
}
