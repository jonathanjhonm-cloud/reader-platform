'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, BookMarked, Clock3, CloudDownload, Plus, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api, type Book } from '@/lib/api';

function BookCard({ book }: { book: Book }) {
  const progress = book.progress?.percentage ?? 0;
  return <Card className="group overflow-hidden transition-colors hover:border-white/[0.16]"><div className="flex h-28 items-end bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-slate-800 p-3"><Badge>{book.fileType.toUpperCase()}</Badge></div><CardContent className="p-4"><p className="truncate text-sm font-medium text-slate-100">{book.title}</p><p className="mt-1 truncate text-xs text-slate-500">{book.author || 'Autor desconhecido'}</p><div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span>{Math.round(progress)}% lido</span><ArrowUpRight size={15} className="opacity-0 transition-opacity group-hover:opacity-100" /></div><Progress value={progress} className="mt-2" /></CardContent></Card>;
}

export default function Dashboard() {
  const router = useRouter(); const [books, setBooks] = useState<Book[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { const token = sessionStorage.getItem('accessToken'); if (!token) { router.replace('/login'); return; } api.books().then(setBooks).catch(() => { sessionStorage.removeItem('accessToken'); router.replace('/login'); }).finally(() => setLoading(false)); }, [router]);
  return <AppShell><section className="mx-auto max-w-6xl px-5 py-9 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-sky-300">Bom ter você aqui.</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">Continue de onde parou</h1><p className="mt-2 text-sm text-slate-500">Sua leitura, sem ruído.</p></div><div className="flex gap-2"><Button variant="secondary" asChild><a href={api.googleUrl}><CloudDownload size={16} />Importar do Drive</a></Button><Button><Plus size={16} />Adicionar arquivo</Button></div></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Card className="md:col-span-2"><CardContent className="flex min-h-40 items-center gap-5 p-5"><div className="hidden h-28 w-20 shrink-0 rounded-lg bg-gradient-to-br from-amber-300 via-orange-500 to-rose-700 sm:block" /><div className="min-w-0"><Badge className="bg-emerald-400/10 text-emerald-300">Em leitura</Badge><h2 className="mt-3 truncate text-lg font-semibold text-slate-100">Sua próxima página começa aqui</h2><p className="mt-1 text-sm text-slate-400">Quando adicionar um livro, seu progresso aparecerá neste espaço.</p><Button variant="ghost" className="mt-3 -ml-3 text-sky-300">Abrir leitura <ArrowUpRight size={15} /></Button></div></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-slate-400"><Sparkles size={16} className="text-violet-300" />Assistente de leitura</div><p className="mt-4 text-sm leading-6 text-slate-300">Destaque um trecho e peça uma explicação, resumo ou contexto.</p><Button variant="outline" size="sm" className="mt-5">Explorar recursos</Button></CardContent></Card></div>
    <div className="mt-10 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-100">Biblioteca</h2><p className="mt-1 text-sm text-slate-500">{books.length ? `${books.length} itens sincronizados` : 'Seus livros vão aparecer aqui.'}</p></div><Button variant="ghost" size="sm">Ver tudo <ArrowUpRight size={14} /></Button></div>
    {loading ? <div className="mt-5 h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" /> : books.length ? <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{books.map((book) => <BookCard key={book.id} book={book} />)}</div> : <Card className="mt-5"><CardContent className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><BookMarked size={24} className="text-slate-500" /><p className="mt-4 text-sm font-medium text-slate-200">Sua biblioteca está vazia</p><p className="mt-1 max-w-sm text-sm text-slate-500">Importe um PDF ou EPUB pelo Google Drive para começar a ler.</p><Button variant="secondary" className="mt-5" asChild><a href={api.googleUrl}><CloudDownload size={16} />Conectar Google Drive</a></Button></CardContent></Card>}
    <div className="mt-10 flex items-center gap-2 text-xs text-slate-600"><Clock3 size={13} />Seu progresso é salvo automaticamente.</div>
  </section></AppShell>;
}
