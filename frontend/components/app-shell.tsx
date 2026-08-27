'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, FolderHeart, Home, Library, LogOut, Menu, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { DriveButton } from '@/components/drive-button';

const nav = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/', label: 'Biblioteca', icon: Library },
  { href: '/', label: 'Coleções', icon: FolderHeart },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [mobileOpen, setMobileOpen] = useState(false);
  async function logout() { await api.logout().catch(() => undefined); sessionStorage.removeItem('accessToken'); router.push('/login'); }
  const sidebar = <aside className="flex h-full w-64 flex-col border-r border-white/[0.07] bg-[#0c0f15]/95 p-3">
    <Link href="/" className="flex h-11 items-center gap-2.5 px-2 text-sm font-semibold tracking-tight text-slate-100"><span className="grid h-7 w-7 place-items-center rounded-md bg-sky-400 text-slate-950"><BookOpen size={16} strokeWidth={2.6} /></span>Lumen</Link>
    <div className="mt-5"><DriveButton fullWidth /></div>
    <nav className="mt-6 space-y-1">
      <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[.13em] text-slate-600">Biblioteca</p>
      {nav.map(({ href, label, icon: Icon }) => <Link key={label} href={href} onClick={() => setMobileOpen(false)} className={cn('flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors', pathname === href && label === 'Início' ? 'bg-white/[0.08] text-slate-100' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}><Icon size={16} />{label}</Link>)}
    </nav>
    <div className="mt-auto space-y-1 border-t border-white/[0.07] pt-3"><Link href="/" className="flex h-9 items-center gap-3 rounded-md px-2 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"><Settings size={16} />Configurações</Link><button onClick={logout} className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"><LogOut size={16} />Sair</button></div>
  </aside>;
  return <div className="noise min-h-screen bg-[#090b10]"><div className="hidden h-screen md:fixed md:inset-y-0 md:left-0 md:block">{sidebar}</div>
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-[#090b10]/80 px-4 backdrop-blur md:ml-64 md:px-8"><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></Button><div className="relative max-w-md flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input placeholder="Buscar na biblioteca" className="h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-sky-400/60" /></div><button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/[0.05]"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-sky-300 to-indigo-400 text-[10px] font-bold text-slate-950">U</span><ChevronDown size={14} className="text-slate-500" /></button></header>
    {mobileOpen && <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}><div className="h-full w-72" onClick={(event) => event.stopPropagation()}>{sidebar}</div></div>}
    <main className="md:ml-64">{children}</main>
  </div>;
}
