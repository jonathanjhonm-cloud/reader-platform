'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter(); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const isLogin = mode === 'login';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = isLogin ? await api.login(String(data.get('email')), String(data.get('password'))) : await api.register(String(data.get('name')), String(data.get('email')), String(data.get('password')));
      sessionStorage.setItem('accessToken', result.accessToken); router.push('/');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.'); } finally { setLoading(false); }
  }
  return <main className="noise grid min-h-screen place-items-center bg-[#090b10] p-5"><div className="w-full max-w-sm"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold text-slate-100"><span className="grid h-7 w-7 place-items-center rounded-md bg-sky-400 text-slate-950"><BookOpen size={16} /></span>Lumen</Link><Card><CardContent className="p-6"><p className="text-xs font-medium uppercase tracking-[.16em] text-sky-300">Sua biblioteca pessoal</p><h1 className="mt-3 text-xl font-semibold text-slate-100">{isLogin ? 'Boas-vindas de volta' : 'Crie sua conta'}</h1><p className="mt-2 text-sm text-slate-500">{isLogin ? 'Entre para continuar sua leitura.' : 'Comece a guardar suas leituras em um só lugar.'}</p>
    <Button variant="outline" className="mt-6 w-full" asChild><a href={api.googleUrl}><span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-800">G</span>Continuar com Google</a></Button><div className="my-6 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/[0.08]" />ou<span className="h-px flex-1 bg-white/[0.08]" /></div>
    <form onSubmit={submit} className="space-y-4">{!isLogin && <label className="grid gap-1.5 text-sm text-slate-300">Nome<input required name="name" placeholder="Como quer ser chamado?" className="h-10 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-400/60" /></label>}<label className="grid gap-1.5 text-sm text-slate-300">E-mail<input required type="email" name="email" placeholder="voce@exemplo.com" className="h-10 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-400/60" /></label><label className="grid gap-1.5 text-sm text-slate-300">Senha<input required minLength={8} type="password" name="password" placeholder="Mínimo de 8 caracteres" className="h-10 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-400/60" /></label>{error && <p className="rounded-md bg-rose-400/10 px-3 py-2 text-xs text-rose-300">{error}</p>}<Button disabled={loading} className="w-full">{loading ? <Loader2 size={16} className="animate-spin" /> : <>{isLogin ? 'Entrar' : 'Criar conta'}<ArrowRight size={16} /></>}</Button></form>
    <p className="mt-6 text-center text-sm text-slate-500">{isLogin ? 'Ainda não tem uma conta?' : 'Já possui uma conta?'} <Link href={isLogin ? '/register' : '/login'} className="text-sky-300 hover:text-sky-200">{isLogin ? 'Criar conta' : 'Entrar'}</Link></p></CardContent></Card></div></main>;
}
