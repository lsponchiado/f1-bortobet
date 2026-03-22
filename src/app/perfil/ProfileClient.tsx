'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Pencil, X, CheckCircle, XCircle, Eye, EyeOff, UserRound } from 'lucide-react';
import { updateName, updateEmail, updateUsername, updatePassword } from '@/lib/actions';

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 py-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1f1f27] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-[#e10600]" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="font-black uppercase italic tracking-tight text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Feedback ─────────────────────────────────────────────────────────────────

function Feedback({ result }: { result: { success?: boolean; error?: string } | null }) {
  if (!result) return null;
  if (result.success) return (
    <div className="flex items-center gap-2 text-green-400 text-xs font-bold mt-3">
      <CheckCircle className="w-4 h-4" /> Atualizado com sucesso.
    </div>
  );
  return (
    <div className="flex items-center gap-2 text-red-400 text-xs font-bold mt-3">
      <XCircle className="w-4 h-4" /> {result.error}
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
        <p className="text-white font-bold mt-0.5">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#e10600] transition-colors px-3 py-1.5 rounded-xl hover:bg-white/5"
      >
        <Pencil className="w-3.5 h-3.5" /> Editar
      </button>
    </div>
  );
}

// ── Simple field modal ────────────────────────────────────────────────────────

function EditFieldModal({
  title, label, defaultValue, onClose,
  onSave,
}: {
  title: string; label: string; defaultValue: string; onClose: () => void;
  onSave: (v: string) => Promise<{ success?: boolean; error?: string }>;
}) {
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await onSave(value);
      setResult(r);
      if (r.success) setTimeout(onClose, 800);
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-full bg-[#2b2b35] rounded-xl px-4 py-3 text-white text-base font-bold focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
          />
        </div>
        <Feedback result={result} />
        <button
          type="submit"
          disabled={isPending || value === defaultValue}
          className="w-full bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/20 text-white font-black py-3 rounded-xl transition-all uppercase italic text-sm"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Modal>
  );
}

// ── Password modal ────────────────────────────────────────────────────────────

function EditPasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await updatePassword(current, next, confirm);
      setResult(r);
      if (r.success) setTimeout(onClose, 800);
    });
  };

  return (
    <Modal title="Alterar Senha" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'Senha atual', value: current, set: setCurrent, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
          { label: 'Nova senha',  value: next,    set: setNext,    show: showNext,    toggle: () => setShowNext(p => !p)    },
          { label: 'Confirmar nova senha', value: confirm, set: setConfirm, show: showNext, toggle: () => setShowNext(p => !p) },
        ].map(({ label, value, set, show, toggle }) => (
          <div key={label}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{label}</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => set(e.target.value)}
                className="w-full bg-[#2b2b35] rounded-xl px-4 py-3 pr-10 text-white text-base font-bold focus:ring-2 focus:ring-[#e10600] outline-none transition-all"
              />
              <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
        <Feedback result={result} />
        <button
          type="submit"
          disabled={isPending || !current || !next || !confirm}
          className="w-full bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/20 text-white font-black py-3 rounded-xl transition-all uppercase italic text-sm"
        >
          {isPending ? 'Alterando...' : 'Alterar Senha'}
        </button>
      </form>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Modal = 'name' | 'email' | 'username' | 'password' | null;

export function ProfileClient({ name, email, username }: { name: string; email: string; username: string }) {
  const [open, setOpen] = useState<Modal>(null);
  const close = () => setOpen(null);

  return (
    <>
      <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        <div className="h-1 w-full bg-[#e10600]" />
        <div className="p-6 border-b border-white/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
            <UserRound className="w-5 h-5 text-[#e10600]" />
          </div>
          <div>
            <h3 className="font-black uppercase italic tracking-tight text-white">Dados Pessoais</h3>
            <p className="text-gray-500 text-xs font-bold mt-0.5">Gerencie suas informações de conta</p>
          </div>
        </div>
        <div className="px-6 py-2">
          <FieldRow label="Nome"     value={name}     onEdit={() => setOpen('name')}     />
          <FieldRow label="E-mail"   value={email}    onEdit={() => setOpen('email')}    />
          <FieldRow label="Username" value={username} onEdit={() => setOpen('username')} />
          <FieldRow label="Senha"    value="••••••••" onEdit={() => setOpen('password')} />
        </div>
      </div>

      {open === 'name' && (
        <EditFieldModal title="Editar Nome" label="Nome" defaultValue={name}
          onClose={close} onSave={updateName} />
      )}
      {open === 'email' && (
        <EditFieldModal title="Editar E-mail" label="E-mail" defaultValue={email}
          onClose={close} onSave={updateEmail} />
      )}
      {open === 'username' && (
        <EditFieldModal title="Editar Username" label="Username" defaultValue={username}
          onClose={close} onSave={updateUsername} />
      )}
      {open === 'password' && <EditPasswordModal onClose={close} />}
    </>
  );
}
