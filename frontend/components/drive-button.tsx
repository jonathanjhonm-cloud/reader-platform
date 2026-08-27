'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function DriveButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  useEffect(() => { void api.driveStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false })); }, []);
  if (!status?.configured) return <Button variant="secondary" disabled title="Configure as credenciais Google no backend" className={fullWidth ? 'w-full justify-start' : ''}><CloudOff size={16} />Drive indisponível</Button>;
  return <Button variant="secondary" className={fullWidth ? 'w-full justify-start' : ''} asChild><a href={api.googleUrl}><Cloud size={16} />{status.connected ? 'Importar do Drive' : 'Conectar Google Drive'}</a></Button>;
}
