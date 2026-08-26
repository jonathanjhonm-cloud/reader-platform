import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Lumen — Sua biblioteca', description: 'Uma biblioteca pessoal para leitura focada.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
