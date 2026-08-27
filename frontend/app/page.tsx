'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, BookMarked, Clock3, MoreVertical, Sparkles, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api, type Book } from '@/lib/api';
import { UploadBookButton } from '@/components/upload-book-button';
import { DriveButton } from '@/components/drive-button';
import { BookCover } from '@/components/book-cover';

function BookCardActions({ book, onDeleted }: { book: Book; onDeleted: (bookId: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function removeBook() {
    if (!window.confirm(`Excluir “${book.title}” da sua biblioteca?`)) return;
    setDeleting(true);
    try { await api.deleteBook(book.id); onDeleted(book.id); }
    catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Não foi possível excluir o livro.'); }
    finally { setDeleting(false); setMenuOpen(false); }
  }
  return <div className="absolute right-3 top-3"><button type="button" aria-label={`Ações para ${book.title}`} aria-expanded={menuOpen} disabled={deleting} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMenuOpen((open) => !open); }} className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-[#090b10]/80 text-slate-200 shadow-lg backdrop-blur transition hover:bg-white/15 disabled:opacity-50"><MoreVertical size={16} /></button>{menuOpen && <div role="menu" onClick={(event) => { event.preventDefault(); event.stopPropagation(); }} className="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-white/10 bg-[#151922] p-1.5 shadow-xl"><button type="button" role="menuitem" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void removeBook(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-400/10"><Trash2 size={14} />Excluir livro</button></div>}</div>;
}

function BookCard({ book, onDeleted }: { book: Book; onDeleted: (bookId: string) => void }) {
  const progress = book.progress?.percentage ?? 0;
  return <Link href={`/books/${book.id}`} className="block"><Card className="group overflow-hidden transition-colors hover:border-white/[0.16]"><div className="relative h-48"><BookCover bookId={book.id} title={book.title} available={Boolean(book.coverMimeType || book.coverUrl)} externalUrl={book.coverUrl} className="h-full" /><BookCardActions book={book} onDeleted={onDeleted} /><div className="absolute bottom-3 left-3 flex gap-2"><Badge>{book.fileType.toUpperCase()}</Badge>{book.contentReviewedByAi && <Badge className="bg-violet-400/15 text-violet-200">Revisado por IA</Badge>}</div></div><CardContent className="p-4"><p className="truncate text-[13px] font-medium tracking-tight text-slate-100">{book.title}</p><p className="mt-1 truncate font-serif text-[11px] italic text-slate-500">{book.author || 'Autor desconhecido'}</p><div className="mt-5 flex items-center justify-between text-[11px] text-slate-500"><span>{book.processingStatus === 'READY' ? `${Math.round(progress)}% lido` : book.processingStatus === 'FAILED' ? 'Falha no processamento' : 'Processando…'}</span><ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" /></div><Progress value={progress} className="mt-2" /></CardContent></Card></Link>;
}

export default function Dashboard() {
  const router = useRouter(); const [books, setBooks] = useState<Book[]>([]); const [loading, setLoading] = useState(true); const [userName, setUserName] = useState('');
  useEffect(() => { const token = sessionStorage.getItem('accessToken'); if (!token) { router.replace('/login'); return; } Promise.all([api.books(), api.me()]).then(([bookList, profile]) => { setBooks(bookList); setUserName(profile.name?.trim() || profile.email.split('@')[0]); }).catch(() => { sessionStorage.removeItem('accessToken'); router.replace('/login'); }).finally(() => setLoading(false)); }, [router]);
  const featuredBook = books[0];
  const featuredProgress = featuredBook?.progress?.percentage ?? 0;
  const removeFromLibrary = (bookId: string) => setBooks((current) => current.filter((item) => item.id !== bookId));
  return <AppShell><section className="mx-auto max-w-6xl px-5 py-9 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-wide text-slate-500">Bom ter você aqui{userName && <>, <span className="font-serif text-[15px] italic tracking-normal text-violet-300">{userName}</span></>}.</p><h1 className="mt-1.5 text-[22px] font-semibold tracking-tight text-slate-100">Continue de onde parou</h1><p className="mt-1.5 text-xs text-slate-500">Sua leitura, sem ruído.</p></div><div className="flex gap-2"><DriveButton /><UploadBookButton onUploaded={(book) => setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)])} /></div></div>
    <div className="mt-8 grid gap-4 md:grid-cols-3"><Card className="overflow-hidden md:col-span-2"><CardContent className="flex min-h-48 items-stretch gap-5 p-5">{featuredBook ? <><BookCover bookId={featuredBook.id} title={featuredBook.title} available={Boolean(featuredBook.coverMimeType || featuredBook.coverUrl)} externalUrl={featuredBook.coverUrl} className="hidden w-28 shrink-0 rounded-lg sm:block" /><div className="flex min-w-0 flex-1 flex-col justify-center"><Badge className="w-fit bg-emerald-400/10 text-emerald-300">Continuar lendo</Badge><h2 className="mt-3 truncate text-base font-semibold tracking-tight text-slate-100">{featuredBook.title}</h2><p className="mt-1 truncate font-serif text-xs italic text-slate-400">{featuredBook.author || 'Autor desconhecido'}</p><div className="mt-5 flex items-center justify-between text-[11px] text-slate-500"><span>{Math.round(featuredProgress)}% concluído</span><span>{featuredBook.wordCount.toLocaleString('pt-BR')} palavras</span></div><Progress value={featuredProgress} className="mt-2" /><Button variant="ghost" size="sm" className="mt-3 -ml-3 w-fit text-sky-300" onClick={() => router.push(`/books/${featuredBook.id}`)}>Continuar leitura <ArrowUpRight size={14} /></Button></div></> : <div className="flex flex-1 items-center"><div><Badge className="bg-emerald-400/10 text-emerald-300">Em leitura</Badge><h2 className="mt-3 text-base font-semibold text-slate-100">Sua próxima página começa aqui</h2><p className="mt-1 text-xs text-slate-400">Quando adicionar um livro, seu progresso aparecerá neste espaço.</p></div></div>}</CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center gap-2 text-[13px] text-slate-400"><Sparkles size={15} className="text-violet-300" />Assistente de leitura</div><p className="mt-4 text-xs leading-5 text-slate-400">Destaque um trecho e peça uma explicação, resumo ou contexto.</p><Button variant="outline" size="sm" disabled={!books.length} className="mt-5" onClick={() => books[0] && router.push(`/books/${books[0].id}`)}>Explorar recursos</Button></CardContent></Card></div>
    <div className="mt-10 flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-100">Biblioteca</h2><p className="mt-1 text-sm text-slate-500">{books.length ? `${books.length} itens sincronizados` : 'Seus livros vão aparecer aqui.'}</p></div><Button variant="ghost" size="sm">Ver tudo <ArrowUpRight size={14} /></Button></div>
    {loading ? <div className="mt-5 h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.025]" /> : books.length ? <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{books.map((book) => <BookCard key={book.id} book={book} onDeleted={removeFromLibrary} />)}</div> : <Card className="mt-5"><CardContent className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><BookMarked size={24} className="text-slate-500" /><p className="mt-4 text-sm font-medium text-slate-200">Sua biblioteca está vazia</p><p className="mt-1 max-w-sm text-sm text-slate-500">Envie um PDF ou EPUB do seu computador para começar a ler.</p><div className="mt-5"><UploadBookButton compact onUploaded={(book) => setBooks([book])} /></div></CardContent></Card>}
    <div className="mt-10 flex items-center gap-2 text-xs text-slate-600"><Clock3 size={13} />Seu progresso é salvo automaticamente.</div>
  </section></AppShell>;
}
