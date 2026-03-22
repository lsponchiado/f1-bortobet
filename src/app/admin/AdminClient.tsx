'use client';

import { useState, useTransition, useEffect } from 'react';
import { Settings, Trophy, Users } from 'lucide-react';
import {
  saveSeasonConfig,
  type SeasonConfigInput,
} from '@/lib/admin-actions';
import { RoundConfigPanel, type RaceSession } from './RoundConfigPanel';
import { InvitePanel } from './InvitePanel';
import { BackupPanel } from './BackupPanel';
import { ResyncPanel } from './ResyncPanel';

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

// Fallback caso SeasonConfig ainda não exista — valores espelham os @default do schema.prisma
const CONFIG_DEFAULTS: SeasonConfigInput = {
  ptsP1: 25, ptsP2: 18, ptsP3: 15, ptsP4: 12, ptsP5: 10, ptsP6: 8, ptsP7: 6, ptsP8: 4, ptsP9: 2, ptsP10: 1,
  sprintPtsP1: 8, sprintPtsP2: 7, sprintPtsP3: 6, sprintPtsP4: 5, sprintPtsP5: 4, sprintPtsP6: 3, sprintPtsP7: 2, sprintPtsP8: 1,
  ptsHailMary: 25, ptsUnderdog: 10, ptsFreefall: 5, ptsFastestLap: 10, ptsSafetyCar: 10, ptsDNF: 10,
  potStroll: 800, pctGps: 75, pctFinal: 25, gpPctP1: 50, gpPctP2: 30, gpPctP3: 20,
  finalPctP1: 35, finalPctP2: 25, finalPctP3: 20, finalPctP4: 12, finalPctP5: 8,
  doublePointsTokens: 3,
};

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }

function SeasonConfigPanel({ initialConfig, strollCount, totalGps, cancelledGps }: { initialConfig: Partial<SeasonConfigInput> | null; strollCount: number; totalGps: number; cancelledGps: number }) {
  const init: SeasonConfigInput = { ...CONFIG_DEFAULTS, ...(initialConfig ?? {}) };
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
          <h3 className="font-black uppercase italic tracking-tight text-white">Configuração da Temporada</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Pontuação, mecânicas de bônus e prêmios</p>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Corrida — P1 a P10</p>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {([1,2,3,4,5,6,7,8,9,10] as const).map(p => (
              <div key={p} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-gray-600 uppercase">P{p}</span>
                <NumInput value={cfg[`ptsP${p}` as keyof SeasonConfigInput] as number} onChange={v => set(`ptsP${p}` as keyof SeasonConfigInput, v)} />
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
                <NumInput value={cfg[`sprintPtsP${p}` as keyof SeasonConfigInput] as number} onChange={v => set(`sprintPtsP${p}` as keyof SeasonConfigInput, v)} />
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

        {/* Prêmios STROLL */}
        {(() => {
          const totalPot = cfg.potStroll * strollCount;
          const gpPotTotal = Math.floor(totalPot * cfg.pctGps / 100);
          const gpPotPerGp = totalGps > 0 ? gpPotTotal / totalGps : 0;
          const cancelledPot = Math.floor(gpPotPerGp * cancelledGps);
          const finalPotBase = Math.floor(totalPot * cfg.pctFinal / 100);
          const finalPot = finalPotBase + cancelledPot;
          return (
            <>
              <div className="border-t border-white/5 pt-6">
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Prêmios — Categoria Stroll ({strollCount} participantes)</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col items-center gap-1 bg-black/20 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Pot por Participante (R$)</span>
                    <NumInput value={cfg.potStroll} onChange={v => set('potStroll', v)} />
                    <span className="text-[10px] text-emerald-400 font-bold">Total: {fmt(totalPot)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center gap-1 bg-black/20 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">% GPs</span>
                      <NumInput value={cfg.pctGps} onChange={v => set('pctGps', v)} />
                      <span className="text-[10px] text-emerald-400 font-bold">{fmt(gpPotTotal)}</span>
                      {cancelledGps > 0 && (
                        <span className="text-[10px] text-red-400 font-bold">-{fmt(cancelledPot)}</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1 bg-black/20 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">% Final</span>
                      <NumInput value={cfg.pctFinal} onChange={v => set('pctFinal', v)} />
                      <span className="text-[10px] text-emerald-400 font-bold">{fmt(finalPotBase)}</span>
                      {cancelledGps > 0 && (
                        <span className="text-[10px] text-yellow-400 font-bold">+{fmt(cancelledPot)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Distribuição por GP (P1/P2/P3)</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['gpPctP1', 'P1'],
                    ['gpPctP2', 'P2'],
                    ['gpPctP3', 'P3'],
                  ] as [keyof SeasonConfigInput, string][]).map(([key, label]) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-gray-600 uppercase">{label} (%)</span>
                      <NumInput value={cfg[key] as number} onChange={v => set(key, v)} />
                      <span className="text-[10px] text-emerald-400 font-bold">{fmt(Math.round(gpPotPerGp * (cfg[key] as number) / 100))}/gp</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Distribuição Final (P1–P5)</p>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    ['finalPctP1', 'P1'],
                    ['finalPctP2', 'P2'],
                    ['finalPctP3', 'P3'],
                    ['finalPctP4', 'P4'],
                    ['finalPctP5', 'P5'],
                  ] as [keyof SeasonConfigInput, string][]).map(([key, label]) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-gray-600 uppercase">{label} (%)</span>
                      <NumInput value={cfg[key] as number} onChange={v => set(key, v)} />
                      <span className="text-[10px] text-emerald-400 font-bold">{fmt(Math.floor(finalPotBase * (cfg[key] as number) / 100))}</span>
                      {cancelledGps > 0 && (
                        <span className="text-[10px] text-yellow-400 font-bold">+{fmt(Math.floor(cancelledPot * (cfg[key] as number) / 100))}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        <button
          onClick={handleSave}
          disabled={isPending}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${saved ? 'bg-green-600 text-white' : 'bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/20 text-white'}`}
        >
          {isPending ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Configuração'}
        </button>
      </div>
    </div>
  );
}


type ConfigData = {
  season: { id: number; year: number; config: Partial<SeasonConfigInput> | null } | null;
  raceSessions: RaceSession[];
};

function BypassToggle({ storageKey, title, description }: { storageKey: string; title: string; description: string }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(sessionStorage.getItem(storageKey) === 'true');
  }, [storageKey]);

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
  const [active, setActive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    setActive(sessionStorage.getItem('betUserBypass') === 'true');
    const stored = sessionStorage.getItem('betUserBypassId');
    if (stored) setSelectedId(parseInt(stored, 10));
  }, []);

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

type ResyncSession = { id: number; type: string; round: number; date: string; gpName: string; openf1Key: number };

export function AdminClient({ configData, allUsers, strollCount, totalGps, cancelledGps: initialCancelledGps, resyncSessions }: { configData: ConfigData; allUsers: UserOption[]; strollCount: number; totalGps: number; cancelledGps: number; resyncSessions: ResyncSession[] }) {
  const [cancelledGps, setCancelledGps] = useState(initialCancelledGps);

  const handleCancelledChange = (delta: number) => {
    setCancelledGps(prev => prev + delta);
  };

  return (
    <div className="flex flex-col gap-4">
      <BypassToggle storageKey="betLockBypass" title="Bypass Temporal" description="Permite apostas a qualquer momento (apenas nesta sessão do navegador)" />
      <UserBypassPanel users={allUsers} />
      <SeasonConfigPanel initialConfig={configData.season?.config ?? null} strollCount={strollCount} totalGps={totalGps} cancelledGps={cancelledGps} />
      <RoundConfigPanel  raceSessions={configData.raceSessions} onCancelledChange={handleCancelledChange} />
      <ResyncPanel sessions={resyncSessions} />
      <InvitePanel />
      <BackupPanel />
    </div>
  );
}
