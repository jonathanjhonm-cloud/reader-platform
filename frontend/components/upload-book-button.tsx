'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { Loader2, Plus, Upload } from 'lucide-react';
import { api, type Book } from '@/lib/api';
import { Button } from '@/components/ui/button';

export type UploadFeedback = { variant: 'success' | 'error'; title: string; description?: string };

export function UploadBookButton({
  onUploaded,
  onFeedback,
  compact = false,
}: {
  onUploaded?: (book: Book) => void;
  onFeedback?: (feedback: UploadFeedback) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const book = await api.uploadBook(file);
      onUploaded?.(book);
      onFeedback?.({
        variant: 'success',
        title: 'Livro adicionado',
        description: `“${book.title}” foi enviado e está sendo preparado para leitura.`,
      });
    } catch (cause) {
      onFeedback?.({
        variant: 'error',
        title: 'Falha ao adicionar arquivo',
        description: cause instanceof Error ? cause.message : 'Não foi possível enviar o arquivo.',
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  return <div className="relative">
    <input ref={inputRef} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" className="hidden" onChange={upload} />
    <Button disabled={loading} size={compact ? 'sm' : 'default'} onClick={() => inputRef.current?.click()}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : compact ? <Upload size={15} /> : <Plus size={16} />}
      {loading ? 'IA preparando leitura…' : compact ? 'Enviar livro' : 'Adicionar arquivo'}
    </Button>
  </div>;
}
