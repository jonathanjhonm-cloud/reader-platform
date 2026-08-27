'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Loader2, Plus, Upload } from 'lucide-react';
import { api, type Book } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function UploadBookButton({ onUploaded, compact = false }: { onUploaded?: (book: Book) => void; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setError('');
    try {
      const book = await api.uploadBook(file);
      onUploaded?.(book);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  return <div className="relative">
    <input ref={inputRef} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" className="hidden" onChange={upload} />
    <Button disabled={loading} size={compact ? 'sm' : 'default'} onClick={() => inputRef.current?.click()}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : compact ? <Upload size={15} /> : <Plus size={16} />}
      {loading ? 'Processando…' : compact ? 'Enviar livro' : 'Adicionar arquivo'}
    </Button>
    {error && <p className="absolute right-0 top-full z-20 mt-2 w-72 rounded-md border border-rose-400/20 bg-[#171018] p-3 text-xs text-rose-300 shadow-xl">{error}</p>}
  </div>;
}
