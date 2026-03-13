'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { RankingPanel } from '@/components/RankingPanel';
import type { UserScore } from '@/lib/scoring';

// ── Desktop filter sub-panel ──────────────────────────────────────────────────

function FilterSubPanel({
  label, options, selected, onToggle, onSelectAll, onSelectNone, showNone = true,
}: {
  label: string;
  options: DropdownOption[];
  selected: Set<number> | null;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onSelectNone?: () => void;
  showNone?: boolean;
}) {
  return (
    <div className="bg-black/30 rounded-2xl p-3 space-y-2.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>

      {options.length === 0 ? (
        <p className="text-[11px] font-bold text-white/20 uppercase tracking-widest">Indisponível</p>
      ) : (
        <>
          {options.length > 1 && (
            <div className="flex gap-1">
              <button
                onClick={onSelectAll}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                  selected === null ? 'bg-[#e10600] text-white' : 'bg-white/5 text-white/40 hover:text-white/70'
                }`}
              >
                Todos
              </button>
              {showNone && onSelectNone && (
                <button
                  onClick={onSelectNone}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                    selected !== null && selected.size === 0 ? 'bg-[#e10600] text-white' : 'bg-white/5 text-white/40 hover:text-white/70'
                  }`}
                >
                  Nenhum
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {options.map(opt => {
              const active = selected === null || selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => onToggle(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border ${
                    active
                      ? 'bg-[#e10600]/15 text-white border-[#e10600]/40'
                      : 'bg-white/5 text-white/30 border-white/5 hover:text-white/60 hover:border-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface GpInfo { gpId: number; gpName: string }

export interface SeasonData {
  seasonId: number;
  year: number;
  scores: UserScore[];
  gps: GpInfo[];
}

interface Props {
  seasons: SeasonData[];
  currentUsername: string;
}

// ── Dropdown multi-select ─────────────────────────────────────────────────────

interface DropdownOption { id: number; label: string }

function DropdownMultiSelect({
  label, options, selected, onToggle, onSelectAll, onSelectNone, showNone = true, maxHint,
}: {
  label: string;
  options: DropdownOption[];
  selected: Set<number> | null;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onSelectNone?: () => void;
  showNone?: boolean;
  maxHint?: string; // shown when max is reached
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buttonLabel =
    selected === null
      ? 'Todos'
      : selected.size === 0
      ? 'Nenhum'
      : selected.size === 1
      ? options.find(o => selected.has(o.id))?.label ?? '1 selecionado'
      : `${selected.size} selecionados`;

  const isFiltered = selected !== null;

  return (
    <div className="relative" ref={ref}>
      <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{label}</p>
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
          isFiltered
            ? 'bg-[#e10600]/10 border-[#e10600]/30 text-white'
            : 'bg-black/40 border-white/10 text-white/70 hover:border-white/20'
        }`}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-2 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-[#15151e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {/* Quick actions */}
          <div className={`flex border-b border-white/5 ${!showNone ? '' : ''}`}>
            <button
              onClick={() => { onSelectAll(); setOpen(false); }}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors hover:bg-white/5 ${
                selected === null ? 'text-[#e10600]' : 'text-white/40'
              }`}
            >
              Todos
            </button>
            {showNone && onSelectNone && (
              <>
                <div className="w-px bg-white/5" />
                <button
                  onClick={onSelectNone}
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors hover:bg-white/5 ${
                    selected !== null && selected.size === 0 ? 'text-[#e10600]' : 'text-white/40'
                  }`}
                >
                  Nenhum
                </button>
              </>
            )}
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto [scrollbar-width:thin]">
            {options.map(opt => {
              const checked = selected === null || selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => onToggle(opt.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    checked ? 'bg-[#e10600] border-[#e10600]' : 'border-white/20'
                  }`}>
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`truncate font-bold ${checked ? 'text-white' : 'text-white/40'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {maxHint && (
            <div className="px-3 py-2 border-t border-white/5">
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{maxHint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────

function ComparisonTable({ columns, rows, currentUsername }: {
  columns: { label: string }[];
  rows: { username: string; points: number[]; total: number }[];
  currentUsername: string;
}) {
  const leader = rows[0]?.total ?? 0;
  const colW = '5rem';
  const gridTemplate = `2rem 1fr ${columns.map(() => colW).join(' ')} ${colW}`;

  return (
    <div className="w-full bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 md:p-8">
        <h2 className="text-xl font-black italic uppercase tracking-tight text-white mb-6">Comparação</h2>

        <div className="overflow-x-auto">
          {/* Header */}
          <div
            style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
            className="gap-3 px-3 pb-3 border-b border-white/10"
          >
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-center">#</span>
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Jogador</span>
            {columns.map((c, i) => (
              <span key={i} className="text-[10px] font-black uppercase text-gray-500 tracking-widest text-right truncate" title={c.label}>
                {c.label}
              </span>
            ))}
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-right">Total</span>
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="py-12 text-center text-gray-600 font-bold uppercase text-sm tracking-widest">
              Sem dados disponíveis
            </div>
          ) : (
            rows.map((row, idx) => {
              const isCurrentUser = row.username === currentUsername;
              const isLeader = idx === 0;
              const delta = row.total - leader;
              return (
                <div
                  key={row.username}
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                  className={`gap-3 items-center px-3 py-3 border-b border-white/5 last:border-0 transition-colors ${
                    isCurrentUser ? 'bg-white/5 rounded-xl' : ''
                  }`}
                >
                  <span className={`text-center font-black italic text-lg tracking-tighter ${isLeader ? 'text-[#e10600]' : 'text-white/30'}`}>
                    {idx + 1}
                  </span>
                  <span className={`font-bold uppercase tracking-wide truncate ${isCurrentUser ? 'text-white' : 'text-white/70'}`}>
                    {row.username}
                    {isCurrentUser && <span className="ml-2 text-[9px] font-black text-[#e10600] uppercase tracking-widest">você</span>}
                  </span>
                  {row.points.map((p, i) => (
                    <span key={i} className="font-bold tabular-nums text-right text-white/50 text-sm">
                      {p.toFixed(1)}
                    </span>
                  ))}
                  <span className={`font-black tabular-nums text-right ${isLeader ? 'text-white text-lg' : 'text-white/80'}`}>
                    {row.total.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MAX_COLS = 5;

export function RankingClient({ seasons, currentUsername }: Props) {
  const [seasonFilter, setSeasonFilter] = useState<Set<number> | null>(
    seasons.length > 1 ? new Set([seasons[0].seasonId]) : null
  );
  const [playerFilter, setPlayerFilter] = useState<Set<number> | null>(null);
  const [gpFilter, setGpFilter] = useState<Set<number> | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Active seasons (max 5 columns)
  const activeSeasonsData = useMemo(() => {
    const filtered = seasonFilter === null
      ? seasons
      : seasons.filter(s => seasonFilter.has(s.seasonId));
    return filtered.slice(0, MAX_COLS);
  }, [seasonFilter, seasons]);

  // All unique GPs across active seasons
  const allGps = useMemo(() => {
    const map = new Map<number, string>();
    for (const sd of activeSeasonsData) {
      for (const g of sd.gps) {
        if (!map.has(g.gpId)) map.set(g.gpId, g.gpName);
      }
    }
    return [...map.entries()].map(([gpId, gpName]) => ({ gpId, gpName }));
  }, [activeSeasonsData]);

  // All unique players across active seasons
  const allPlayerOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const sd of activeSeasonsData) {
      for (const s of sd.scores) map.set(s.userId, s.username);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [activeSeasonsData]);

  const allGpIds = allGps.map(g => g.gpId);
  const allPlayerIds = allPlayerOptions.map(p => p.id);

  // Comparison mode
  const showSeasonCols = activeSeasonsData.length > 1;
  const showGpCols = !showSeasonCols && gpFilter !== null && gpFilter.size >= 2;
  const comparisonMode = showSeasonCols || showGpCols;

  // How many columns are in use (for max hint)
  const seasonColCount = activeSeasonsData.length;
  const gpColCount = gpFilter === null ? allGpIds.length : gpFilter.size;

  // Toggles
  const toggleSeason = (id: number) => {
    setSeasonFilter(prev => {
      const allIds = seasons.map(s => s.seasonId);
      const current = new Set(prev ?? allIds);
      if (current.has(id)) {
        current.delete(id);
        if (current.size === 0) return null;
      } else {
        if (current.size >= MAX_COLS) return prev;
        current.add(id);
      }
      return current.size === allIds.length ? null : current;
    });
  };

  const togglePlayer = (id: number) => {
    setPlayerFilter(prev => {
      const current = new Set(prev ?? allPlayerIds);
      if (current.has(id)) current.delete(id); else current.add(id);
      return current.size === allPlayerIds.length ? null : current;
    });
  };

  const toggleGp = (id: number) => {
    setGpFilter(prev => {
      const current = new Set(prev ?? allGpIds);
      if (current.has(id)) {
        current.delete(id);
      } else {
        if (prev !== null && current.size >= MAX_COLS) return prev;
        current.add(id);
      }
      return current.size === allGpIds.length ? null : current;
    });
  };

  // Handle season change resetting GP filter
  const handleSeasonToggle = (id: number) => {
    toggleSeason(id);
    setGpFilter(null); // reset GP filter when seasons change
  };

  const activeFilterCount =
    (seasonFilter !== null ? 1 : 0) +
    (playerFilter !== null ? 1 : 0) +
    (gpFilter !== null ? 1 : 0);

  // Comparison data
  const comparisonData = useMemo(() => {
    if (!comparisonMode) return null;

    if (showSeasonCols) {
      const cols = activeSeasonsData.map(sd => ({ label: String(sd.year) }));
      const usernameMap = new Map<number, string>();
      for (const sd of activeSeasonsData) {
        for (const s of sd.scores) usernameMap.set(s.userId, s.username);
      }
      const rows = [...usernameMap.entries()]
        .filter(([uid]) => playerFilter === null || playerFilter.has(uid))
        .map(([uid, username]) => {
          const points = activeSeasonsData.map(sd => {
            const score = sd.scores.find(s => s.userId === uid);
            if (!score) return 0;
            if (gpFilter !== null) {
              return score.byGp.filter(g => gpFilter.has(g.gpId)).reduce((s, g) => s + g.totalPoints, 0);
            }
            return score.totalPoints;
          });
          return { username, points, total: points.reduce((a, b) => a + b, 0) };
        })
        .sort((a, b) => b.total - a.total);
      return { cols, rows };
    }

    if (showGpCols) {
      const sd = activeSeasonsData[0];
      if (!sd) return null;
      const selectedGps = allGps.filter(g => gpFilter!.has(g.gpId));
      const cols = selectedGps.map(g => ({ label: g.gpName }));
      const rows = sd.scores
        .filter(s => playerFilter === null || playerFilter.has(s.userId))
        .map(s => {
          const points = selectedGps.map(g => {
            const gp = s.byGp.find(bg => bg.gpId === g.gpId);
            return gp?.totalPoints ?? 0;
          });
          return { username: s.username, points, total: points.reduce((a, b) => a + b, 0) };
        })
        .sort((a, b) => b.total - a.total);
      return { cols, rows };
    }

    return null;
  }, [comparisonMode, showSeasonCols, showGpCols, activeSeasonsData, playerFilter, gpFilter, allGps]);

  // Normal filtered entries
  const filteredEntries = useMemo(() => {
    if (comparisonMode) return [];
    const sd = activeSeasonsData[0];
    if (!sd) return [];
    return sd.scores
      .filter(s => playerFilter === null || playerFilter.has(s.userId))
      .map(s => ({
        username: s.username,
        totalPoints: gpFilter === null
          ? s.totalPoints
          : s.byGp.filter(g => gpFilter.has(g.gpId)).reduce((sum, g) => sum + g.totalPoints, 0),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [comparisonMode, activeSeasonsData, playerFilter, gpFilter]);

  const seasonOptions = seasons.map(s => ({ id: s.seasonId, label: String(s.year) }));
  const gpOptions = allGps.map(g => ({ id: g.gpId, label: g.gpName }));
  const seasonLabel = activeSeasonsData.map(s => s.year).join(' · ');

  // ── Filter panels ────────────────────────────────────────────────────────────

  const filterHeader = (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-black italic uppercase tracking-tight text-white">Filtros</h2>
      {activeFilterCount > 0 && (
        <button
          onClick={() => { setSeasonFilter(null); setPlayerFilter(null); setGpFilter(null); }}
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
        >
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
    </div>
  );

  // Mobile: dropdowns
  const mobileFilterPanel = (
    <div className="bg-[#1f1f27] rounded-3xl border-t-4 border-t-[#e10600] border border-white/5">
      <div className="p-5 space-y-5">
        {filterHeader}
        <DropdownMultiSelect
          label="Temporada"
          options={seasonOptions}
          selected={seasonFilter}
          onToggle={handleSeasonToggle}
          onSelectAll={() => { setSeasonFilter(null); setGpFilter(null); }}
          showNone={false}
          maxHint={seasonColCount >= MAX_COLS ? `Máximo ${MAX_COLS} temporadas` : undefined}
        />
        <DropdownMultiSelect
          label="Jogadores"
          options={allPlayerOptions}
          selected={playerFilter}
          onToggle={togglePlayer}
          onSelectAll={() => setPlayerFilter(null)}
          onSelectNone={() => setPlayerFilter(new Set())}
        />
        <DropdownMultiSelect
          label="Corridas"
          options={gpOptions}
          selected={gpFilter}
          onToggle={toggleGp}
          onSelectAll={() => setGpFilter(null)}
          onSelectNone={() => setGpFilter(new Set())}
          maxHint={gpFilter !== null && gpColCount >= MAX_COLS ? `Máximo ${MAX_COLS} corridas` : undefined}
        />
      </div>
    </div>
  );

  // Desktop: inline sub-panels with toggle buttons
  const desktopFilterPanel = (
    <div className="bg-[#1f1f27] rounded-3xl border-t-4 border-t-[#e10600] border border-white/5">
      <div className="p-5 space-y-4">
        {filterHeader}
        <FilterSubPanel
          label="Temporada"
          options={seasonOptions}
          selected={seasonFilter}
          onToggle={handleSeasonToggle}
          onSelectAll={() => { setSeasonFilter(null); setGpFilter(null); }}
          showNone={false}
        />
        <FilterSubPanel
          label="Jogadores"
          options={allPlayerOptions}
          selected={playerFilter}
          onToggle={togglePlayer}
          onSelectAll={() => setPlayerFilter(null)}
          onSelectNone={() => setPlayerFilter(new Set())}
        />
        <FilterSubPanel
          label="Corridas"
          options={gpOptions}
          selected={gpFilter}
          onToggle={toggleGp}
          onSelectAll={() => setGpFilter(null)}
          onSelectNone={() => setGpFilter(new Set())}
        />
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="flex items-start justify-start mb-8 px-1">
        <button
          onClick={() => setMobileFiltersOpen(p => !p)}
          className="lg:hidden flex items-center gap-2 bg-[#1f1f27] border border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase text-gray-400"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-[#e10600] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {mobileFiltersOpen && <div className="lg:hidden mb-6">{mobileFilterPanel}</div>}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="hidden lg:block w-72 flex-shrink-0 sticky top-6">{desktopFilterPanel}</div>
        <div className="flex-1 min-w-0 w-full">
          {comparisonMode && comparisonData ? (
            <ComparisonTable
              columns={comparisonData.cols}
              rows={comparisonData.rows}
              currentUsername={currentUsername}
            />
          ) : (
            <RankingPanel entries={filteredEntries} currentUsername={currentUsername} />
          )}
        </div>
      </div>
    </div>
  );
}
