'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Cloud, CloudOff, ExternalLink, FileText, Loader2, X } from 'lucide-react';
import { api, type Book, type DriveFile } from '@/lib/api';
import { Button } from '@/components/ui/button';

function formatFileSize(value?: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

function DriveImportDialog({ onClose, onImported }: { onClose: () => void; onImported?: (book: Book) => void }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importingId, setImportingId] = useState<string>();
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const loadFiles = useCallback(async (pageToken?: string) => {
    if (pageToken) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const page = await api.driveFiles(pageToken);
      setFiles((current) => pageToken ? [...current, ...page.files] : page.files);
      setNextPageToken(page.nextPageToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os arquivos do Drive.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api.driveFiles().then((page) => {
      if (!active) return;
      setFiles(page.files);
      setNextPageToken(page.nextPageToken);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os arquivos do Drive.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !importingId) onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [importingId, onClose]);

  async function importFile(file: DriveFile) {
    setImportingId(file.id);
    setError('');
    try {
      const book = await api.importDriveFile(file.id);
      setImportedIds((current) => [...current, file.id]);
      onImported?.(book);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar este arquivo.');
    } finally {
      setImportingId(undefined);
    }
  }

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !importingId && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="drive-dialog-title" className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11151d] shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] p-5">
        <div><div className="flex items-center gap-2 text-sky-300"><Cloud size={17} /><span className="text-xs font-medium uppercase tracking-[.14em]">Google Drive</span></div><h2 id="drive-dialog-title" className="mt-2 text-lg font-semibold text-slate-100">Importar para a biblioteca</h2><p className="mt-1 text-sm text-slate-500">Escolha um PDF ou EPUB conectado à sua conta.</p></div>
        <button type="button" aria-label="Fechar" disabled={Boolean(importingId)} onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-40"><X size={17} /></button>
      </header>
      {error && <div className="mx-5 mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</div>}
      <div className="min-h-40 flex-1 overflow-y-auto p-3 sm:p-5">
        {loading ? <div className="grid min-h-40 place-items-center text-sm text-slate-500"><div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Carregando arquivos…</div></div>
          : files.length ? <div className="space-y-2">{files.map((file) => {
            const imported = importedIds.includes(file.id);
            const importing = importingId === file.id;
            const details = [formatFileSize(file.size), file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('pt-BR') : null].filter(Boolean).join(' · ');
            return <article key={file.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-300"><FileText size={18} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-200">{file.name}</p><p className="mt-1 text-xs text-slate-600">{details || (file.mimeType.includes('epub') ? 'EPUB' : 'PDF')}</p></div>
              {file.webViewLink && <a href={file.webViewLink} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.name} no Drive`} className="rounded-md p-2 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><ExternalLink size={15} /></a>}
              <Button size="sm" variant={imported ? 'secondary' : 'outline'} disabled={Boolean(importingId) || imported} onClick={() => void importFile(file)}>{importing ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}{imported ? 'Adicionado' : importing ? 'Importando…' : 'Importar'}</Button>
            </article>;
          })}</div>
          : <div className="grid min-h-40 place-items-center text-center"><div><FileText size={22} className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-300">Nenhum PDF ou EPUB encontrado</p><p className="mt-1 text-xs text-slate-600">Adicione arquivos compatíveis ao Google Drive e tente novamente.</p></div></div>}
      </div>
      <footer className="flex justify-between border-t border-white/[0.08] p-4"><Button variant="ghost" size="sm" disabled={loading || loadingMore} onClick={() => void loadFiles()}>Atualizar</Button>{nextPageToken && <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadFiles(nextPageToken)}>{loadingMore && <Loader2 size={14} className="animate-spin" />}Carregar mais</Button>}</footer>
    </section>
  </div>;
}

export function DriveButton({ fullWidth = false, onImported }: { fullWidth?: boolean; onImported?: (book: Book) => void }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { void api.driveStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false })); }, []);
  if (!status?.configured) return <Button variant="secondary" disabled title="Configure as credenciais Google no backend" className={fullWidth ? 'w-full justify-start' : ''}><CloudOff size={16} />Drive indisponível</Button>;
  if (!status.connected) return <Button variant="secondary" className={fullWidth ? 'w-full justify-start' : ''} asChild><a href={api.googleUrl}><Cloud size={16} />Conectar Google Drive</a></Button>;
  return <><Button variant="secondary" className={fullWidth ? 'w-full justify-start' : ''} onClick={() => setOpen(true)}><Cloud size={16} />Importar do Drive</Button>{open && <DriveImportDialog onClose={() => setOpen(false)} onImported={onImported} />}</>;
}
