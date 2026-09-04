'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Highlighter, Loader2, MessageSquarePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BookSection, HighlightColor, ReaderHighlight } from '@/lib/api';
import { cn } from '@/lib/utils';

export const HIGHLIGHT_COLORS: Array<{ value: HighlightColor; label: string; swatch: string; text: string }> = [
  { value: 'yellow', label: 'Amarelo', swatch: 'bg-amber-300', text: 'bg-amber-300/35 decoration-amber-200/60' },
  { value: 'green', label: 'Verde', swatch: 'bg-emerald-400', text: 'bg-emerald-400/30 decoration-emerald-300/60' },
  { value: 'blue', label: 'Azul', swatch: 'bg-sky-400', text: 'bg-sky-400/30 decoration-sky-300/60' },
  { value: 'pink', label: 'Rosa', swatch: 'bg-pink-400', text: 'bg-pink-400/30 decoration-pink-300/60' },
  { value: 'purple', label: 'Roxo', swatch: 'bg-violet-400', text: 'bg-violet-400/30 decoration-violet-300/60' },
];

type PendingSelection = { start: number; end: number; text: string; x: number; y: number };

export function ReaderText({
  section,
  highlights,
  onCreate,
  onOpenHighlight,
  onSelectionChange,
}: {
  section: BookSection;
  highlights: ReaderHighlight[];
  onCreate: (input: { sectionId: string; start: number; end: number; color: HighlightColor; note?: string }) => Promise<void>;
  onOpenHighlight: (highlight: ReaderHighlight) => void;
  onSelectionChange: (text: string | null) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  function captureSelection() {
    const selected = window.getSelection();
    const range = selected?.rangeCount ? selected.getRangeAt(0) : null;
    const container = contentRef.current;
    if (!selected || !range || selected.isCollapsed || !container || !container.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const before = document.createRange();
    before.selectNodeContents(container);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    if (highlights.some((item) => start < item.range.end && end > item.range.start)) {
      setSelection(null);
      onSelectionChange(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const text = section.content.slice(start, end);
    setSelection({
      start,
      end,
      text,
      x: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170),
      y: Math.max(rect.top - 10, 76),
    });
    onSelectionChange(text.trim() || null);
    setNoteOpen(false);
    setNote('');
  }

  async function save(withNote: boolean) {
    if (!selection) return;
    setSaving(true);
    try {
      await onCreate({
        sectionId: section.id,
        start: selection.start,
        end: selection.end,
        color,
        note: withNote ? note.trim() : undefined,
      });
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setNoteOpen(false);
      setNote('');
    } catch {
      // O componente pai exibe o erro e a seleção permanece disponível para nova tentativa.
    } finally { setSaving(false); }
  }

  const ordered = [...highlights].sort((left, right) => left.range.start - right.range.start);
  const fragments: ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((highlight) => {
    const start = Math.max(cursor, Math.min(highlight.range.start, section.content.length));
    const end = Math.max(start, Math.min(highlight.range.end, section.content.length));
    if (start > cursor) fragments.push(section.content.slice(cursor, start));
    const style = HIGHLIGHT_COLORS.find((item) => item.value === highlight.color)?.text ?? HIGHLIGHT_COLORS[0].text;
    fragments.push(<button key={highlight.id} type="button" onClick={() => onOpenHighlight(highlight)} className={cn('rounded-sm px-0.5 text-left text-inherit underline decoration-1 underline-offset-2 transition hover:brightness-125', style)}>{section.content.slice(start, end)}</button>);
    cursor = end;
  });
  if (cursor < section.content.length) fragments.push(section.content.slice(cursor));

  return <>
    <div ref={contentRef} onMouseUp={() => window.setTimeout(captureSelection, 0)} onKeyUp={captureSelection} className="mt-7 whitespace-pre-wrap font-serif text-[18px] leading-8 text-slate-300 selection:bg-sky-400/30">{fragments}</div>
    {selection && <div onMouseDown={(event) => event.preventDefault()} style={{ left: selection.x, top: selection.y }} className="fixed z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-[#151922]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <Highlighter size={15} className="shrink-0 text-slate-400" />
        <div className="flex flex-1 gap-1.5">{HIGHLIGHT_COLORS.map((item) => <button key={item.value} type="button" aria-label={item.label} onClick={() => setColor(item.value)} className={cn('h-6 w-6 rounded-full border-2 transition hover:scale-110', item.swatch, color === item.value ? 'border-white' : 'border-transparent')} />)}</div>
        <button type="button" aria-label="Fechar" onClick={() => setSelection(null)} className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><X size={14} /></button>
      </div>
      <p className="mt-2 truncate text-xs italic text-slate-500">“{selection.text.trim()}”</p>
      {noteOpen && <textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} onMouseDown={(event) => event.stopPropagation()} maxLength={5_000} placeholder="Escreva sua anotação…" className="mt-3 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-400/50" />}
      <div className="mt-3 flex justify-end gap-2">
        {!noteOpen && <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}><MessageSquarePlus size={14} />Anotar</Button>}
        <Button size="sm" disabled={saving || (noteOpen && !note.trim())} onClick={() => void save(noteOpen)}>{saving && <Loader2 size={14} className="animate-spin" />}{noteOpen ? 'Salvar anotação' : 'Destacar'}</Button>
      </div>
    </div>}
  </>;
}
