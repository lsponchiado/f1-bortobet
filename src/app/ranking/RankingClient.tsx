'use client';

import { useState, useRef, useCallback, useMemo, useTransition } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { RankingFilterBar, type RankingGpOption } from './RankingFilterBar';
import { RankingTable, type RankingEntry } from './RankingTable';
import { getUserBetForGp } from '@/lib/admin-actions';
import type { UserBetData, BetGridItem } from '@/lib/constants';

export interface ScoreRow {
  userId: number;
  username: string;
  name: string;
  category: string;
  grandPrixId: number;
  grandPrixName: string;
  sessionId: number;
  sessionType: string;
  points: number;
  totalPoints: number;
}

export interface EarningRow {
  userId: number;
  grandPrixId: number;
  gpEarning: number;
  seasonEarning: number;
  totalEarning: number;
}

interface RankingClientProps {
  scores: ScoreRow[];
  gpOptions: RankingGpOption[];
  earnings: EarningRow[];
}

// ── Bet Detail Modal ──────────────────────────────────────────────────────────

function BetGridSection({ title, grid, results }: {
  title: string;
  grid: BetGridItem[];
  results: { somaPos: number[]; somaTotal: number; hailMary?: number[]; underdog?: number[]; freefall?: number[]; fastestLap?: number; safetyCar?: number; abandonos?: number } | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{title}</p>
      <div className="space-y-1">
        {grid.map((item, i) => {
          const posPoints = results?.somaPos[i] ?? 0;
          const hmPoints = results?.hailMary?.[i] ?? 0;
          const udPoints = results?.underdog?.[i] ?? 0;
          const ffPoints = results?.freefall?.[i] ?? 0;
          const flPoints = results && item.fastestLap ? (results.fastestLap ?? 0) : 0;
          const totalPts = results ? posPoints + hmPoints + udPoints + ffPoints + flPoints : null;
          return (
            <div key={item.position} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-black/20">
              <span className="text-[10px] font-black text-gray-600 w-5 text-right">P{item.position}</span>
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: item.team.color }} />
              <span className="text-xs font-bold text-white flex-1 truncate">
                {item.lastName}
                <span className="text-gray-600 ml-1 text-[10px]">{item.code}</span>
              </span>
              {item.fastestLap && <span className="text-[9px] font-black text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">FL</span>}
              {hmPoints > 0 && <span className="text-[9px] font-black text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">HM</span>}
              {udPoints > 0 && <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">UD</span>}
              {ffPoints > 0 && <span className="text-[9px] font-black text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded">FF</span>}
              {totalPts !== null && (
                <span className={`text-xs font-black tabular-nums w-8 text-right ${totalPts > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                  {totalPts > 0 ? `+${totalPts}` : totalPts}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BetDetailModal({ username, betData, onClose }: {
  username: string;
  betData: UserBetData;
  onClose: () => void;
}) {
  const hasBoth = !!betData.race && !!betData.sprint;
  const [tab, setTab] = useState<'race' | 'sprint'>(betData.race ? 'race' : 'sprint');
  const hasNoBets = !betData.race && !betData.sprint;

  const activeBet = tab === 'race' ? betData.race : betData.sprint;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] bg-[#1f1f27] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        <div className="h-1 w-full bg-[#e10600]" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <span className="font-black uppercase italic tracking-tight text-white">{username}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasBoth && (
          <div className="flex border-b border-white/5 shrink-0">
            {(['race', 'sprint'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  tab === t ? 'text-white bg-white/5 border-b-2 border-[#e10600]' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'race' ? 'Corrida' : 'Sprint'}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {hasNoBets && (
            <p className="text-gray-500 font-bold text-sm text-center py-8 uppercase italic tracking-widest">
              Sem apostas neste GP
            </p>
          )}

          {activeBet && (
            <BetGridSection
              title={tab === 'race' ? 'Corrida' : 'Sprint'}
              grid={activeBet.grid}
              results={activeBet.result}
            />
          )}

          {tab === 'race' && betData.race && (
            <div className="flex flex-wrap gap-2">
              {betData.race.predictedSC > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-1 rounded-lg">
                    SC/VSC: {betData.race.predictedSC}
                  </span>
                  {betData.race.result && (betData.race.result.safetyCar ?? 0) > 0 && (
                    <span className="text-[10px] font-black text-green-400">+{betData.race.result.safetyCar}</span>
                  )}
                </span>
              )}
              {betData.race.predictedDNF > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg">
                    DNF: {betData.race.predictedDNF}
                  </span>
                  {betData.race.result && (betData.race.result.abandonos ?? 0) > 0 && (
                    <span className="text-[10px] font-black text-green-400">+{betData.race.result.abandonos}</span>
                  )}
                </span>
              )}
              {betData.race.doublePoints && (
                <span className="text-[10px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-lg">
                  Double Points
                </span>
              )}
            </div>
          )}

          {activeBet?.result && (
            <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</span>
              <span className={`text-sm font-black tabular-nums ${activeBet.result.somaTotal > 0 ? 'text-green-400' : activeBet.result.somaTotal < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                {activeBet.result.somaTotal > 0 ? `+${activeBet.result.somaTotal}` : activeBet.result.somaTotal}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RankingClient({ scores, gpOptions, earnings }: RankingClientProps) {
  const [selectedGpId, setSelectedGpId] = useState<number | null>(null);
  const [betModal, setBetModal] = useState<{ username: string; data: UserBetData } | null>(null);
  const [isPending, startTransition] = useTransition();
  const tableRef = useRef<HTMLDivElement>(null);

  const handleScreenshot = useCallback(async () => {
    if (!tableRef.current) return;
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(tableRef.current, { pixelRatio: 2, backgroundColor: '#1f1f27' });
    const link = document.createElement('a');
    link.download = `ranking${selectedGpId ? `-gp${selectedGpId}` : '-geral'}.png`;
    link.href = dataUrl;
    link.click();
  }, [selectedGpId]);

  const showGpColumns = selectedGpId !== null;

  const earningMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of earnings) {
      map.set(`${e.userId}-${e.grandPrixId}`, e.gpEarning);
      map.set(`${e.userId}-total`, e.totalEarning);
    }
    return map;
  }, [earnings]);

  const rankings: RankingEntry[] = useMemo(() => {
    const filtered = selectedGpId !== null
      ? scores.filter(s => s.grandPrixId === selectedGpId)
      : scores;

    const userMap = new Map<number, {
      userId: number; username: string; name: string; category: string;
      sprintPoints: number; racePoints: number; totalPoints: number;
    }>();

    for (const s of filtered) {
      if (!userMap.has(s.userId)) {
        userMap.set(s.userId, {
          userId: s.userId, username: s.username, name: s.name, category: s.category,
          sprintPoints: 0, racePoints: 0, totalPoints: s.totalPoints,
        });
      }
      const u = userMap.get(s.userId)!;
      if (s.sessionType === 'SPRINT') u.sprintPoints += s.points;
      else if (s.sessionType === 'RACE') u.racePoints += s.points;
    }

    const entries = [...userMap.values()].map(u => {
      const gpTotal = u.sprintPoints + u.racePoints;
      const ganhos = selectedGpId !== null
        ? (earningMap.get(`${u.userId}-${selectedGpId}`) ?? 0)
        : (earningMap.get(`${u.userId}-total`) ?? 0);
      return { ...u, gpTotal, total: u.totalPoints, gap: 0, ganhos };
    });

    entries.sort((a, b) => showGpColumns ? b.gpTotal - a.gpTotal : b.total - a.total);
    const maxPts = entries[0] ? (showGpColumns ? entries[0].gpTotal : entries[0].total) : 0;
    for (const e of entries) {
      e.gap = maxPts - (showGpColumns ? e.gpTotal : e.total);
    }

    return entries;
  }, [scores, selectedGpId, showGpColumns, earningMap]);

  const hasSprint = useMemo(() => {
    if (!showGpColumns) return false;
    return scores.some(s => s.grandPrixId === selectedGpId && s.sessionType === 'SPRINT');
  }, [scores, selectedGpId, showGpColumns]);

  const handleUserClick = (userId: number) => {
    if (!selectedGpId) return;
    const user = rankings.find(r => r.userId === userId);
    if (!user) return;

    startTransition(async () => {
      const data = await getUserBetForGp(userId, selectedGpId);
      setBetModal({ username: user.username, data });
    });
  };

  if (scores.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 font-black uppercase italic tracking-widest">
          Sem dados de pontuação
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RankingFilterBar
        gpOptions={gpOptions}
        selectedGpId={selectedGpId}
        onGpChange={(gpId) => { setSelectedGpId(gpId); setBetModal(null); }}
      />

      <div ref={tableRef}>
        <RankingTable
          entries={rankings}
          showGpColumns={showGpColumns}
          showSprint={hasSprint}
          onUserClick={showGpColumns ? handleUserClick : undefined}
        />
      </div>

      <button
        onClick={handleScreenshot}
        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Camera size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Salvar Imagem</span>
      </button>

      {isPending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-[#e10600] animate-spin" />
        </div>
      )}

      {betModal && (
        <BetDetailModal
          username={betModal.username}
          betData={betModal.data}
          onClose={() => setBetModal(null)}
        />
      )}
    </div>
  );
}
