'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { RefreshCw, Users, Flag, CheckCircle, XCircle, X, Settings, Trophy } from 'lucide-react';
import {
  syncPaddock, syncResults, syncOpenF1,
  saveSeasonConfig, saveRaceConfig,
  type SeasonConfigInput, type RaceConfigInput,
} from '@/lib/admin-actions';

type SyncStatus = { success: boolean; output: string } | null;

function SyncModal({ title, running, status, onClose }: {
  title: string; running: boolean; status: SyncStatus; onClose: () => void;
}) {
  const logRef = useRef<HTMLPreElement>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [status?.output]);
  const done = !running && status !== null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={done ? onClose : undefined} />
      <div className="relative w-full max-w-lg bg-[#1f1f27] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className={`h-1 w-full transition-colors duration-500 ${running ? 'bg-[#e10600]' : status?.success ? 'bg-green-500' : 'bg-red-600'}`} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {running && <RefreshCw className="w-4 h-4 text-[#e10600] animate-spin" />}
            {done && status?.success  && <CheckCircle className="w-4 h-4 text-green-500" />}
            {done && !status?.success && <XCircle     className="w-4 h-4 text-red-500"   />}
            <span className="font-black uppercase italic tracking-tight text-white">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {running && <span className="text-gray-500 text-xs font-bold tabular-nums">{elapsed}s</span>}
            {done && <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>}
          </div>
        </div>
        <div className="h-0.5 w-full bg-white/5 relative overflow-hidden">
          {running && <div className="absolute inset-y-0 w-1/3 bg-[#e10600] rounded-full animate-[progress_1.4s_ease-in-out_infinite]" />}
          {done && <div className={`absolute inset-0 ${status?.success ? 'bg-green-500' : 'bg-red-500'}`} />}
        </div>
        <div className="p-4">
          {running && !status && <p className="text-gray-500 text-xs font-bold uppercase tracking-widest text-center py-6 animate-pulse">Executando script...</p>}
          {status && (
            <pre ref={logRef} className="text-xs font-mono leading-relaxed text-green-300/80 bg-black/40 rounded-2xl p-4 max-h-64 overflow-y-auto [scrollbar-width:thin] whitespace-pre-wrap break-words">
              {status.output || (status.success ? 'Concluído sem saída.' : 'Erro desconhecido.')}
            </pre>
          )}
        </div>
        {done && (
          <div className="px-4 pb-4">
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-black uppercase tracking-widest transition-all">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncCard({ title, description, icon: Icon, onSync }: {
  title: string; description: string; icon: React.ElementType;
  onSync: () => Promise<{ success: boolean; output: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<SyncStatus>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const handleClick = () => {
    setStatus(null); setModalOpen(true);
    startTransition(async () => { const result = await onSync(); setStatus(result); });
  };
  const lastSuccess = !isPending && status?.success === true;
  const lastError   = !isPending && status?.success === false;
  return (
    <>
      <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
        <div className={`h-1 w-full transition-colors duration-500 ${lastSuccess ? 'bg-green-500' : lastError ? 'bg-red-700' : 'bg-[#e10600]'}`} />
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-[#e10600]" />
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tight text-white">{title}</h3>
              <p className="text-gray-500 text-xs font-bold mt-0.5 max-w-xs">{description}</p>
            </div>
          </div>
          <button onClick={handleClick} disabled={isPending} className="flex items-center gap-2 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/20 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex-shrink-0 active:scale-95">
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? 'Rodando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
      {modalOpen && <SyncModal title={title} running={isPending} status={status} onClose={() => { setModalOpen(false); setStatus(null); }} />}
    </>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-sm font-bold text-center tabular-nums focus:outline-none focus:border-[#e10600]/60"
    />
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-[#e10600]' : 'bg-white/10'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

const RACE_DEFAULTS   = { ptsP1: 25, ptsP2: 18, ptsP3: 15, ptsP4: 12, ptsP5: 10, ptsP6: 8, ptsP7: 6, ptsP8: 4, ptsP9: 2, ptsP10: 1 };
const SPRINT_DEFAULTS = { sprintPtsP1: 8, sprintPtsP2: 7, sprintPtsP3: 6, sprintPtsP4: 5, sprintPtsP5: 4, sprintPtsP6: 3, sprintPtsP7: 2, sprintPtsP8: 1 };
const BONUS_DEFAULTS  = { ptsHailMary: 25, ptsUnderdog: 10, ptsFreefall: 5, ptsFastestLap: 10, ptsSafetyCar: 10, ptsDNF: 10 };

function SeasonConfigPanel({ initialConfig }: { initialConfig: any }) {
  const init: SeasonConfigInput = { ...RACE_DEFAULTS, ...SPRINT_DEFAULTS, ...BONUS_DEFAULTS, doublePointsTokens: 3, ...(initialConfig ?? {}) };
  const [cfg, setCfg] = useState<SeasonConfigInput>(init);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = (key: keyof SeasonConfigInput, v: number) => { setCfg(prev => ({ ...prev, [key]: v })); setSaved(false); };
  const handleSave = () => { startTransition(async () => { await saveSeasonConfig(cfg); setSaved(true); }); };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Pontuação da Temporada</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Pontos por posição exata e mecânicas de bônus</p>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Corrida — P1 a P10</p>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {([1,2,3,4,5,6,7,8,9,10] as const).map(p => (
              <div key={p} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-gray-600 uppercase">P{p}</span>
                <NumInput value={(cfg as any)[`ptsP${p}`]} onChange={v => set(`ptsP${p}` as any, v)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Sprint — P1 a P8</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {([1,2,3,4,5,6,7,8] as const).map(p => (
              <div key={p} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-gray-600 uppercase">P{p}</span>
                <NumInput value={(cfg as any)[`sprintPtsP${p}`]} onChange={v => set(`sprintPtsP${p}` as any, v)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Mecânicas de Bônus</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              ['ptsHailMary',   'Hail Mary'],
              ['ptsUnderdog',   'Underdog'],
              ['ptsFreefall',   'Freefall'],
              ['ptsFastestLap', 'Volta Rápida'],
              ['ptsSafetyCar',  'Safety Car'],
              ['ptsDNF',        'DNF'],
            ] as [keyof SeasonConfigInput, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between bg-black/20 rounded-xl px-3 py-2 gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{label}</span>
                <NumInput value={cfg[key] as number} onChange={v => set(key, v)} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Double Points — Tokens por temporada</span>
          <NumInput value={cfg.doublePointsTokens} onChange={v => set('doublePointsTokens', v)} />
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${saved ? 'bg-green-600 text-white' : 'bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/20 text-white'}`}
        >
          {isPending ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Pontuação'}
        </button>
      </div>
    </div>
  );
}

type RaceSession = {
  id: number; round: number;
  grandPrix: { name: string; country: string };
  raceConfig: RaceConfigInput | null;
};

const MECHANICS: { key: keyof RaceConfigInput; label: string; short: string }[] = [
  { key: 'allowHailMary',     label: 'Hail Mary',     short: 'HM'  },
  { key: 'allowUnderdog',     label: 'Underdog',      short: 'UD'  },
  { key: 'allowFreefall',     label: 'Freefall',      short: 'FF'  },
  { key: 'allowAllIn',        label: 'All-In',        short: 'AI'  },
  { key: 'allowFastestLap',   label: 'Volta Rápida',  short: 'FL'  },
  { key: 'allowSafetyCar',    label: 'Safety Car',    short: 'SC'  },
  { key: 'allowDNF',          label: 'DNF',           short: 'DNF' },
  { key: 'allowDoublePoints', label: 'Double Points', short: 'DP'  },
];

const DEFAULT_RC: RaceConfigInput = {
  allowHailMary: true, allowUnderdog: true, allowFreefall: true, allowAllIn: true,
  allowFastestLap: true, allowSafetyCar: true, allowDNF: true, allowDoublePoints: true,
};

function RoundConfigPanel({ raceSessions }: { raceSessions: RaceSession[] }) {
  const [configs, setConfigs] = useState<Record<number, RaceConfigInput>>(() =>
    Object.fromEntries(raceSessions.map(s => [s.id, s.raceConfig ?? { ...DEFAULT_RC }]))
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  const toggle = (id: number, key: keyof RaceConfigInput) => {
    setConfigs(prev => ({ ...prev, [id]: { ...prev[id], [key]: !prev[id][key] } }));
    setSaved(prev => ({ ...prev, [id]: false }));
  };

  const handleSave = async (id: number) => {
    setSaving(id);
    await saveRaceConfig(id, configs[id]);
    setSaving(null);
    setSaved(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Mecânicas por Rodada</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Ative ou desative cada mecânica individualmente por corrida</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-500 w-40">Rodada</th>
              {MECHANICS.map(m => (
                <th key={m.key} className="px-3 py-3 text-xs font-black uppercase tracking-widest text-gray-500 text-center">
                  <span className="hidden lg:inline">{m.label}</span>
                  <span className="lg:hidden">{m.short}</span>
                </th>
              ))}
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {raceSessions.map(s => {
              const cfg = configs[s.id];
              const gpShort = s.grandPrix.name.replace(' Grand Prix', '');
              return (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <span className="text-white/30 font-black text-xs mr-2">R{s.round}</span>
                    <span className="text-white font-bold text-xs">{gpShort}</span>
                  </td>
                  {MECHANICS.map(m => (
                    <td key={m.key} className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        <Toggle value={cfg[m.key]} onChange={() => toggle(s.id, m.key)} />
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleSave(s.id)}
                      disabled={saving === s.id}
                      className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${saved[s.id] ? 'bg-green-600/20 text-green-400' : 'bg-white/5 hover:bg-[#e10600] hover:text-white text-gray-400'}`}
                    >
                      {saving === s.id ? '...' : saved[s.id] ? '✓' : 'OK'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ConfigData = {
  season: { id: number; year: number; config: any } | null;
  raceSessions: RaceSession[];
};

function BypassToggle({ storageKey, title, description }: { storageKey: string; title: string; description: string }) {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(storageKey) === 'true';
  });

  const handleToggle = (value: boolean) => {
    setActive(value);
    sessionStorage.setItem(storageKey, String(value));
    if (!value && storageKey === 'betUserBypass') {
      sessionStorage.removeItem('betUserBypassId');
    }
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className={`h-1 w-full transition-colors duration-500 ${active ? 'bg-yellow-500' : 'bg-[#e10600]'}`} />
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-black uppercase italic tracking-tight text-white">{title}</h3>
            <p className="text-gray-500 text-xs font-bold mt-0.5">{description}</p>
          </div>
        </div>
        <Toggle value={active} onChange={handleToggle} />
      </div>
    </div>
  );
}

type UserOption = { id: number; username: string | null; name: string | null };

function UserBypassPanel({ users }: { users: UserOption[] }) {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('betUserBypass') === 'true';
  });
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem('betUserBypassId');
    return stored ? parseInt(stored, 10) : null;
  });

  const handleToggle = (value: boolean) => {
    setActive(value);
    sessionStorage.setItem('betUserBypass', String(value));
    if (!value) {
      setSelectedId(null);
      sessionStorage.removeItem('betUserBypassId');
    }
  };

  const handleUserChange = (id: number | null) => {
    setSelectedId(id);
    if (id) {
      sessionStorage.setItem('betUserBypassId', String(id));
    } else {
      sessionStorage.removeItem('betUserBypassId');
    }
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className={`h-1 w-full transition-colors duration-500 ${active ? 'bg-yellow-500' : 'bg-[#e10600]'}`} />
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-black uppercase italic tracking-tight text-white">Bypass de Usuário</h3>
              <p className="text-gray-500 text-xs font-bold mt-0.5">Permite apostar em nome de outro usuário (apenas nesta sessão do navegador)</p>
            </div>
          </div>
          <Toggle value={active} onChange={handleToggle} />
        </div>
        {active && (
          <select
            value={selectedId ?? ''}
            onChange={e => handleUserChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-yellow-500/60 cursor-pointer appearance-none"
          >
            <option value="">Selecione um usuário...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username || u.name || `User ${u.id}`}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function AdminClient({ configData, allUsers }: { configData: ConfigData; allUsers: UserOption[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4">
        <SyncCard title="Paddock"    description="Identifica pilotos nas sessões próximas e detecta substitutos via OpenF1" icon={Users}     onSync={syncPaddock}  />
        <SyncCard title="Resultados" description="Importa posições finais, fastest lap, SC e DNF de sessões passadas"        icon={Flag}      onSync={syncResults}  />
        <SyncCard title="OpenF1"     description="Sincroniza pilotos, equipes, GPs e sessões da temporada atual"             icon={RefreshCw} onSync={syncOpenF1}   />
      </div>
      <BypassToggle storageKey="betLockBypass" title="Bypass Temporal" description="Permite apostas a qualquer momento (apenas nesta sessão do navegador)" />
      <UserBypassPanel users={allUsers} />
      <SeasonConfigPanel initialConfig={configData.season?.config ?? null} />
      <RoundConfigPanel  raceSessions={configData.raceSessions} />
    </div>
  );
}
