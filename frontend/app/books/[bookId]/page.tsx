'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MessageSquareText, Sparkles } from 'lucide-react';
import { api, type BookContent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

type AssistantAction = 'summarize' | 'explain' | 'context' | 'question';

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookContent | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const section = book?.sections[sectionIndex];
  const percentage = useMemo(() => book?.sections.length ? ((sectionIndex + 1) / book.sections.length) * 100 : 0, [book, sectionIndex]);

  useEffect(() => {
    if (!sessionStorage.getItem('accessToken')) { router.replace('/login'); return; }
    api.bookContent(bookId).then((result) => {
      setBook(result);
      const savedIndex = result.sections.findIndex((item) => item.id === result.progress?.location);
      if (savedIndex >= 0) setSectionIndex(savedIndex);
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o livro.');
    }).finally(() => setLoading(false));
  }, [bookId, router]);

  function goTo(index: number) {
    if (!book) return;
    const next = Math.max(0, Math.min(index, book.sections.length - 1));
    setSectionIndex(next); setAnswer('');
    const target = book.sections[next];
    if (target) void api.updateProgress(book.id, target.id, ((next + 1) / book.sections.length) * 100).catch(() => undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function ask(action: AssistantAction) {
    if (!section) return;
    const selectedText = window.getSelection()?.toString().trim() || undefined;
    setAsking(true); setAnswer('');
    try {
      const result = await api.askAssistant(bookId, { action, selectedText, question: action === 'question' ? question : undefined, sectionId: section.id });
      setAnswer(result.answer);
    } catch (cause) {
      setAnswer(cause instanceof Error ? cause.message : 'Não foi possível consultar o assistente.');
    } finally { setAsking(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#090b10]"><Loader2 className="animate-spin text-sky-300" /></main>;
  if (error || !book) return <main className="grid min-h-screen place-items-center bg-[#090b10] p-6 text-center"><div><p className="text-rose-300">{error || 'Livro não encontrado.'}</p><Button className="mt-4" asChild><Link href="/">Voltar à biblioteca</Link></Button></div></main>;
  if (book.processingStatus !== 'READY') return <main className="grid min-h-screen place-items-center bg-[#090b10] p-6 text-center"><div><p className="text-lg text-slate-100">{book.processingStatus === 'FAILED' ? 'Não foi possível processar este livro.' : 'O livro ainda está sendo processado…'}</p><p className="mt-2 text-sm text-slate-500">{book.processingError}</p><Button className="mt-5" asChild><Link href="/">Voltar à biblioteca</Link></Button></div></main>;

  return <div className="min-h-screen bg-[#090b10] text-slate-200">
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#090b10]/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6"><Button variant="ghost" size="icon" asChild><Link href="/"><ArrowLeft size={18} /></Link></Button><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{book.title}</p><p className="text-xs text-slate-500">{Math.round(percentage)}% · {book.wordCount.toLocaleString('pt-BR')} palavras</p></div><div className="hidden w-48 sm:block"><Progress value={percentage} /></div></div></header>
    <div className="mx-auto grid max-w-7xl lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="hidden border-r border-white/[0.07] p-4 lg:block"><p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-600">Conteúdo</p><nav className="max-h-[calc(100vh-7rem)] space-y-1 overflow-auto">{book.sections.map((item, index) => <button key={item.id} onClick={() => goTo(index)} className={`w-full rounded-md px-3 py-2 text-left text-xs leading-5 ${index === sectionIndex ? 'bg-sky-400/10 text-sky-200' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}>{item.title || `Seção ${index + 1}`}</button>)}</nav></aside>
      <main className="min-w-0 px-5 py-10 sm:px-10 lg:px-16"><article className="mx-auto max-w-2xl"><p className="text-xs font-medium uppercase tracking-[.16em] text-sky-400/80">{section?.title || `Seção ${sectionIndex + 1}`}</p><div className="mt-7 whitespace-pre-wrap font-serif text-[18px] leading-8 text-slate-300 selection:bg-sky-400/30">{section?.content}</div><div className="mt-12 flex items-center justify-between border-t border-white/[0.08] pt-6"><Button variant="outline" disabled={sectionIndex === 0} onClick={() => goTo(sectionIndex - 1)}><ChevronLeft size={16} />Anterior</Button><Button disabled={sectionIndex === book.sections.length - 1} onClick={() => goTo(sectionIndex + 1)}>Próxima<ChevronRight size={16} /></Button></div></article></main>
      <aside className="border-t border-white/[0.07] p-5 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-l lg:border-t-0"><div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Sparkles size={16} className="text-violet-300" />Assistente de leitura</div><p className="mt-2 text-xs leading-5 text-slate-500">Selecione um trecho ou use a seção atual.</p><div className="mt-4 grid grid-cols-3 gap-2"><Button variant="outline" size="sm" onClick={() => ask('summarize')}>Resumir</Button><Button variant="outline" size="sm" onClick={() => ask('explain')}>Explicar</Button><Button variant="outline" size="sm" onClick={() => ask('context')}>Contexto</Button></div><div className="mt-5 flex gap-2"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && question.trim()) void ask('question'); }} placeholder="Pergunte sobre o trecho" className="h-9 min-w-0 flex-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs outline-none focus:border-sky-400/60" /><Button size="icon" disabled={!question.trim() || asking} onClick={() => ask('question')}><MessageSquareText size={16} /></Button></div>{asking && <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Lendo o trecho…</div>}{answer && <div className="mt-6 whitespace-pre-wrap rounded-lg border border-white/[0.08] bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{answer}</div>}</aside>
    </div>
  </div>;
}
