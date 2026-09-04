'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Loader2, MessageSquareText, Sparkles, X } from 'lucide-react';
import { ReaderMarksPanel } from '@/components/reader-marks-panel';
import { ReaderText } from '@/components/reader-text';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api, type BookContent, type HighlightColor, type ReaderHighlight } from '@/lib/api';

type AssistantAction = 'summarize' | 'explain' | 'context' | 'question';
type Notice = { variant: 'success' | 'error'; title: string; description?: string };

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookContent | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [assistantError, setAssistantError] = useState('');
  const [assistantSelection, setAssistantSelection] = useState('');
  const [answerScope, setAnswerScope] = useState<'selection' | 'section' | 'book' | null>(null);
  const [asking, setAsking] = useState(false);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const section = book?.sections[sectionIndex];
  const percentage = useMemo(() => book?.sections.length ? ((sectionIndex + 1) / book.sections.length) * 100 : 0, [book, sectionIndex]);
  const sectionHighlights = useMemo(() => section ? highlights.filter((item) => item.range.sectionId === section.id) : [], [highlights, section]);

  useEffect(() => {
    Promise.all([api.bookContent(bookId), api.highlights(bookId)]).then(([result, marks]) => {
      setBook(result);
      setHighlights(marks);
      const savedIndex = result.sections.findIndex((item) => item.id === result.progress?.location);
      if (savedIndex >= 0) setSectionIndex(savedIndex);
    }).catch((cause) => {
      if (!sessionStorage.getItem('accessToken')) { router.replace('/login'); return; }
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o livro.');
    }).finally(() => setLoading(false));
  }, [bookId, router]);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function goTo(index: number) {
    if (!book) return;
    const next = Math.max(0, Math.min(index, book.sections.length - 1));
    setSectionIndex(next);
    setAnswer('');
    setAssistantError('');
    setAssistantSelection('');
    setAnswerScope(null);
    const target = book.sections[next];
    if (target) void api.updateProgress(book.id, target.id, ((next + 1) / book.sections.length) * 100).catch(() => undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function ask(action: AssistantAction) {
    if (!section) return;
    setAsking(true);
    setAnswer('');
    setAssistantError('');
    setAnswerScope(null);
    try {
      const result = await api.askAssistant(bookId, {
        action,
        selectedText: assistantSelection || undefined,
        question: action === 'question' ? question : undefined,
        sectionId: section.id,
      });
      setAnswer(result.answer);
      setAnswerScope(result.scope);
      if (action === 'question') setQuestion('');
    } catch (cause) {
      setAssistantError(cause instanceof Error ? cause.message : 'Não foi possível consultar o assistente.');
    } finally { setAsking(false); }
  }

  async function createHighlight(input: { sectionId: string; start: number; end: number; color: HighlightColor; note?: string }) {
    try {
      const created = await api.createHighlight(bookId, input);
      setHighlights((current) => [...current, created]);
      setNotice({ variant: 'success', title: input.note ? 'Anotação salva' : 'Trecho destacado' });
    } catch (cause) {
      const description = cause instanceof Error ? cause.message : 'Não foi possível salvar a marcação.';
      setNotice({ variant: 'error', title: 'Falha ao salvar marcação', description });
      throw cause;
    }
  }

  async function updateHighlight(highlightId: string, input: { color?: HighlightColor; note?: string }) {
    try {
      const updated = await api.updateHighlight(bookId, highlightId, input);
      setHighlights((current) => current.map((item) => item.id === highlightId ? updated : item));
      setNotice({ variant: 'success', title: input.color ? 'Cor atualizada' : input.note?.trim() ? 'Anotação salva' : 'Anotação removida' });
    } catch (cause) {
      const description = cause instanceof Error ? cause.message : 'Não foi possível atualizar a marcação.';
      setNotice({ variant: 'error', title: 'Falha ao atualizar marcação', description });
      throw cause;
    }
  }

  async function deleteHighlight(highlightId: string) {
    try {
      await api.deleteHighlight(bookId, highlightId);
      setHighlights((current) => current.filter((item) => item.id !== highlightId));
      setNotice({ variant: 'success', title: 'Marcação excluída' });
    } catch (cause) {
      const description = cause instanceof Error ? cause.message : 'Não foi possível excluir a marcação.';
      setNotice({ variant: 'error', title: 'Falha ao excluir marcação', description });
      throw cause;
    }
  }

  function jumpToHighlight(highlight: ReaderHighlight) {
    if (!book) return;
    const index = book.sections.findIndex((item) => item.id === highlight.range.sectionId);
    if (index >= 0) {
      goTo(index);
      setAssistantSelection(highlight.text);
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#090b10]"><Loader2 className="animate-spin text-sky-300" /></main>;
  if (error || !book) return <main className="grid min-h-screen place-items-center bg-[#090b10] p-6 text-center"><div><p className="text-rose-300">{error || 'Livro não encontrado.'}</p><Button className="mt-4" asChild><Link href="/">Voltar à biblioteca</Link></Button></div></main>;
  if (book.processingStatus !== 'READY') return <main className="grid min-h-screen place-items-center bg-[#090b10] p-6 text-center"><div><p className="text-lg text-slate-100">{book.processingStatus === 'FAILED' ? 'Não foi possível processar este livro.' : 'O livro ainda está sendo processado…'}</p><p className="mt-2 text-sm text-slate-500">{book.processingError}</p><Button className="mt-5" asChild><Link href="/">Voltar à biblioteca</Link></Button></div></main>;

  return <div className="min-h-screen bg-[#090b10] text-slate-200">
    {notice && <div className="operation-alert fixed right-4 top-20 z-[100] w-[calc(100%-2rem)] max-w-sm"><Alert {...notice} onClose={() => setNotice(null)} /></div>}
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#090b10]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild><Link href="/"><ArrowLeft size={18} /></Link></Button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{book.title}</p><div className="flex items-center gap-2 text-xs text-slate-500"><span>{Math.round(percentage)}% · {book.wordCount.toLocaleString('pt-BR')} palavras</span>{book.contentReviewedByAi && <span className="hidden items-center gap-1 text-emerald-400/80 sm:flex"><CheckCircle2 size={12} />Revisado por IA{book.removedSectionCount > 0 ? ` · ${book.removedSectionCount} removida${book.removedSectionCount > 1 ? 's' : ''}` : ''}</span>}</div></div>
        <div className="hidden w-48 sm:block"><Progress value={percentage} /></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="hidden border-r border-white/[0.07] p-4 lg:block"><p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-600">Conteúdo</p><nav className="max-h-[calc(100vh-7rem)] space-y-1 overflow-auto">{book.sections.map((item, index) => <button key={item.id} onClick={() => goTo(index)} className={`w-full rounded-md px-3 py-2 text-left text-xs leading-5 ${index === sectionIndex ? 'bg-sky-400/10 text-sky-200' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}>{item.title || `Seção ${index + 1}`}</button>)}</nav></aside>
      <main className="min-w-0 px-5 py-10 sm:px-10 lg:px-16">
        <article className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[.16em] text-sky-400/80">{section?.title || `Seção ${sectionIndex + 1}`}</p>
          {section && <ReaderText section={section} highlights={sectionHighlights} onCreate={createHighlight} onSelectionChange={(text) => setAssistantSelection(text ?? '')} onOpenHighlight={(highlight) => { setFocusedHighlightId(highlight.id); setAssistantSelection(highlight.text); }} />}
          <div className="mt-12 flex items-center justify-between border-t border-white/[0.08] pt-6"><Button variant="outline" disabled={sectionIndex === 0} onClick={() => goTo(sectionIndex - 1)}><ChevronLeft size={16} />Anterior</Button><Button disabled={sectionIndex === book.sections.length - 1} onClick={() => goTo(sectionIndex + 1)}>Próxima<ChevronRight size={16} /></Button></div>
        </article>
      </main>
      <aside className="border-t border-white/[0.07] p-5 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Sparkles size={16} className="text-violet-300" />Assistente de leitura</div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Selecione um trecho ou use a seção atual.</p>
        {assistantSelection && <div className="mt-3 rounded-lg border border-violet-400/20 bg-violet-400/[0.06] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-medium uppercase tracking-wider text-violet-300">Trecho selecionado</span><button type="button" aria-label="Usar a seção inteira" onClick={() => setAssistantSelection('')} className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"><X size={12} /></button></div><p className="mt-1.5 line-clamp-3 font-serif text-xs italic leading-5 text-slate-400">“{assistantSelection}”</p></div>}
        <div className="mt-4 grid grid-cols-3 gap-2"><Button variant="outline" size="sm" disabled={asking} onClick={() => ask('summarize')}>Resumir</Button><Button variant="outline" size="sm" disabled={asking} onClick={() => ask('explain')}>Explicar</Button><Button variant="outline" size="sm" disabled={asking} onClick={() => ask('context')}>Contexto</Button></div>
        <div className="mt-5 flex gap-2"><input value={question} disabled={asking} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && question.trim()) void ask('question'); }} placeholder={assistantSelection ? 'Pergunte sobre o trecho' : 'Pergunte sobre a seção'} className="h-9 min-w-0 flex-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs outline-none disabled:opacity-60 focus:border-sky-400/60" /><Button size="icon" aria-label="Enviar pergunta" disabled={!question.trim() || asking} onClick={() => ask('question')}><MessageSquareText size={16} /></Button></div>
        {asking && <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Lendo o trecho…</div>}
        {assistantError && <div role="alert" className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-xs leading-5 text-rose-200">{assistantError}</div>}
        {answer && <div className="mt-6 rounded-lg border border-white/[0.08] bg-white/[0.035] p-4"><p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">Resposta sobre {answerScope === 'selection' ? 'o trecho' : answerScope === 'book' ? 'o livro' : 'a seção'}</p><div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{answer}</div></div>}
        <ReaderMarksPanel highlights={highlights} focusedHighlightId={focusedHighlightId} onJump={jumpToHighlight} onUpdate={updateHighlight} onDelete={deleteHighlight} />
      </aside>
    </div>
  </div>;
}
