'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { api } from '@/lib/api';

export function BookCover({ bookId, title, available, externalUrl, className = '' }: { bookId: string; title: string; available?: boolean; externalUrl?: string | null; className?: string }) {
  const [source, setSource] = useState<string | null>(externalUrl ?? null);

  useEffect(() => {
    let objectUrl: string | undefined;
    let active = true;
    const load = async () => {
      if (!available) {
        const refreshed = await api.refreshBookCover(bookId);
        if (!refreshed.available) return;
        if (refreshed.coverUrl) { if (active) setSource(refreshed.coverUrl); return; }
      }
      const blob = await api.bookCover(bookId);
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    };
    void load().catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [available, bookId, externalUrl]);

  return <div className={`relative overflow-hidden bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-slate-800 ${className}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {source ? <img src={source} alt={`Capa de ${title}`} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><BookOpen size={28} className="text-slate-500" /></div>}
  </div>;
}
