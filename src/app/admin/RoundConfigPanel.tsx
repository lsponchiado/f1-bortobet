'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { saveRaceConfig, toggleGpCancelled, type RaceConfigInput } from '@/lib/admin-actions';

const MECHANICS: { key: keyof RaceConfigInput; label: string }[] = [
  { key: 'allowHailMary',     label: 'Hail Mary' },
  { key: 'allowUnderdog',     label: 'Underdog' },
  { key: 'allowFreefall',     label: 'Freefall' },
  { key: 'allowFastestLap',   label: 'Volta Rápida' },
  { key: 'allowSafetyCar',    label: 'Safety Car' },
  { key: 'allowDNF',          label: 'DNF' },
  { key: 'allowDoublePoints', label: 'Double Points' },
];

const DEFAULT_RC: RaceConfigInput = {
  allowHailMary: true, allowUnderdog: true, allowFreefall: true,
  allowFastestLap: true, allowSafetyCar: true, allowDNF: true, allowDoublePoints: true,
};

export type RaceSession = {
  id: number;
  round: number;
  grandPrix: { id: number; name: string; country: string; cancelled: boolean };
  raceConfig: RaceConfigInput | null;
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-[#e10600]' : 'bg-white/10'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

export function RoundConfigPanel({ raceSessions, onCancelledChange }: { raceSessions: RaceSession[]; onCancelledChange: (delta: number) => void }) {
  const [selectedSessionId, setSelectedSessionId] = useState<number>(raceSessions[0]?.id ?? 0);
  const [configs, setConfigs] = useState<Record<number, RaceConfigInput>>(() =>
    Object.fromEntries(raceSessions.map(s => [s.id, s.raceConfig ?? { ...DEFAULT_RC }]))
  );
  const [cancelled, setCancelled] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(raceSessions.map(s => [s.grandPrix.id, s.grandPrix.cancelled]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const session = raceSessions.find(s => s.id === selectedSessionId);
  const cfg = configs[selectedSessionId];
  const isCancelled = session ? (cancelled[session.grandPrix.id] ?? false) : false;

  const toggle = (key: keyof RaceConfigInput) => {
    setConfigs(prev => ({ ...prev, [selectedSessionId]: { ...prev[selectedSessionId], [key]: !prev[selectedSessionId][key] } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveRaceConfig(selectedSessionId, configs[selectedSessionId]);
    setSaving(false);
    setSaved(true);
  };

  const handleCancelToggle = async (value: boolean) => {
    if (!session) return;
    setCancelled(prev => ({ ...prev, [session.grandPrix.id]: value }));
    onCancelledChange(value ? 1 : -1);
    await toggleGpCancelled(session.grandPrix.id, value);
  };

  const handleSessionChange = (id: number) => {
    setSelectedSessionId(id);
    setSaved(false);
  };

  if (!session || !cfg) return null;

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Configuração de GP</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Selecione o GP e configure as mecânicas</p>
        </div>
      </div>

      <div className="p-5 border-b border-white/5">
        <select
          value={selectedSessionId}
          onChange={e => handleSessionChange(parseInt(e.target.value, 10))}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-[#e10600]/60 appearance-none cursor-pointer"
        >
          {raceSessions.map(s => {
            const gpShort = s.grandPrix.name.replace(' Grand Prix', '');
            const cx = cancelled[s.grandPrix.id] ? ' (Cancelado)' : '';
            return (
              <option key={s.id} value={s.id}>
                R{s.round} — {gpShort}{cx}
              </option>
            );
          })}
        </select>
      </div>

      <div className={`p-5 space-y-3 transition-opacity ${isCancelled ? 'opacity-40' : ''}`}>
        {MECHANICS.map(m => (
          <div key={m.key} className="flex items-center justify-between py-1">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{m.label}</span>
            <Toggle value={cfg[m.key]} onChange={() => toggle(m.key)} />
          </div>
        ))}

        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Cancelado</span>
            <Toggle value={isCancelled} onChange={handleCancelToggle} />
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            saved
              ? 'bg-green-600/20 text-green-400'
              : 'bg-white/5 hover:bg-[#e10600] hover:text-white text-gray-400'
          }`}
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Mecânicas'}
        </button>
      </div>
    </div>
  );
}
