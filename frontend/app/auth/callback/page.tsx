'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function GoogleCallbackPage() {
  const router = useRouter(); const [error, setError] = useState('');
  useEffect(() => { api.refresh().then((result) => { sessionStorage.setItem('accessToken', result.accessToken); router.replace('/'); }).catch(() => setError('Não foi possível concluir o login com Google. Tente novamente.')); }, [router]);
  return <main className="grid min-h-screen place-items-center bg-[#090b10] p-5"><div className="text-center"><Loader2 className="mx-auto animate-spin text-sky-300" /><p className="mt-4 text-sm text-slate-400">{error || 'Conectando sua conta…'}</p></div></main>;
}
