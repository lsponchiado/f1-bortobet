'use client';

import { useState, useTransition, useRef } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import { createBackup, restoreBackup } from '@/lib/admin-actions';

export function BackupPanel() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await createBackup();
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const date = new Date().toISOString().slice(0, 10);
        const link = document.createElement('a');
        link.download = `f1-bortobet-${date}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        setStatus({ type: 'success', message: 'Backup gerado com sucesso' });
      } else {
        setStatus({ type: 'error', message: result.error ?? 'Erro ao gerar backup' });
      }
    });
  };

  const handleRestore = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!confirm('Tem certeza? Isso vai sobrescrever todos os dados atuais do banco.')) return;

    setStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      startTransition(async () => {
        const result = await restoreBackup(json);
        if (result.success) {
          setStatus({ type: 'success', message: 'Backup restaurado com sucesso' });
        } else {
          setStatus({ type: 'error', message: result.error ?? 'Erro ao restaurar' });
        }
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Backup</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Gere ou restaure um backup completo do banco de dados</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleBackup}
            disabled={isPending}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-[#e10600] hover:text-white text-gray-400 disabled:bg-white/10 disabled:text-white/20"
          >
            <Download size={14} />
            {isPending ? 'Gerando...' : 'Gerar Backup'}
          </button>
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-yellow-600 hover:text-white text-gray-400 disabled:bg-white/10 disabled:text-white/20"
          >
            <Upload size={14} />
            Restaurar
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />

        {status && (
          <div className={`flex items-center justify-center py-3 rounded-xl border ${
            status.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <span className="text-xs font-bold">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
