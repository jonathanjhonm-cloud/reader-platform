'use client';

import { useState } from 'react';
import { Loader2, MessageSquareText, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HIGHLIGHT_COLORS } from '@/components/reader-text';
import type { HighlightColor, ReaderHighlight } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ReaderMarksPanel({
  highlights,
  focusedHighlightId,
  onJump,
  onUpdate,
  onDelete,
}: {
  highlights: ReaderHighlight[];
  focusedHighlightId?: string | null;
  onJump: (highlight: ReaderHighlight) => void;
  onUpdate: (highlightId: string, input: { color?: HighlightColor; note?: string }) => Promise<void>;
  onDelete: (highlightId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ReaderHighlight | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  function edit(highlight: ReaderHighlight) {
    setEditingId(highlight.id);
    setDraft(highlight.annotation?.content ?? '');
  }

  async function save(highlightId: string) {
    setSaving(true);
    try {
      await onUpdate(highlightId, { note: draft });
      setEditingId(null);
    } catch {
      // O componente pai mantém e apresenta o erro da operação.
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleting || deletingBusy) return;
    setDeletingBusy(true);
    try {
      await onDelete(deleting.id);
      setDeleting(null);
    } catch {
      // O componente pai mantém e apresenta o erro da operação.
    } finally { setDeletingBusy(false); }
  }

  return <section className="mt-7 border-t border-white/[0.08] pt-6">
    <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><MessageSquareText size={16} className="text-amber-300" />Marcações</div>
    <p className="mt-2 text-xs leading-5 text-slate-500">Seus destaques e anotações aparecem aqui.</p>
    <div className="mt-4 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
      {!highlights.length && <div className="rounded-lg border border-dashed border-white/10 p-4 text-xs leading-5 text-slate-500">Selecione um trecho no texto para destacar ou anotar.</div>}
      {highlights.map((highlight) => {
        const selectedColor = HIGHLIGHT_COLORS.find((item) => item.value === highlight.color) ?? HIGHLIGHT_COLORS[0];
        return <article key={highlight.id} className={cn('rounded-xl border bg-white/[0.025] p-3 transition', focusedHighlightId === highlight.id ? 'border-sky-400/40 ring-1 ring-sky-400/20' : 'border-white/[0.08]')}>
          <button type="button" onClick={() => onJump(highlight)} className="block w-full text-left">
            <p className="line-clamp-3 font-serif text-xs italic leading-5 text-slate-400">“{highlight.text.trim()}”</p>
          </button>
          <div className="mt-3 flex items-center gap-1.5">{HIGHLIGHT_COLORS.map((item) => <button key={item.value} type="button" aria-label={`Alterar para ${item.label}`} onClick={() => void onUpdate(highlight.id, { color: item.value }).catch(() => undefined)} className={cn('h-4 w-4 rounded-full border transition hover:scale-110', item.swatch, item.value === selectedColor.value ? 'border-white' : 'border-transparent')} />)}<div className="ml-auto flex gap-1"><button type="button" aria-label="Editar anotação" onClick={() => edit(highlight)} className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><Pencil size={13} /></button><button type="button" aria-label="Excluir marcação" onClick={() => setDeleting(highlight)} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 size={13} /></button></div></div>
          {editingId === highlight.id ? <div className="mt-3"><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5_000} placeholder="Adicione uma anotação…" className="min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-2.5 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-400/50" /><div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditingId(null)}>Cancelar</Button><Button size="sm" disabled={saving} onClick={() => void save(highlight.id)}>{saving && <Loader2 size={13} className="animate-spin" />}Salvar</Button></div></div> : highlight.annotation && <p className="mt-3 whitespace-pre-wrap border-l-2 border-white/10 pl-3 text-xs leading-5 text-slate-300">{highlight.annotation.content}</p>}
        </article>;
      })}
    </div>
    <ConfirmDialog open={Boolean(deleting)} title="Excluir marcação?" description="O destaque e a anotação vinculada serão removidos." confirmLabel="Excluir marcação" loading={deletingBusy} onConfirm={() => void confirmDelete()} onClose={() => setDeleting(null)} />
  </section>;
}
