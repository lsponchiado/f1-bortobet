'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface RankingGpOption {
  id: number;
  name: string;
}

interface RankingFilterBarProps {
  gpOptions: RankingGpOption[];
  selectedGpId: number | null;
  onGpChange: (gpId: number | null) => void;
}

export function RankingFilterBar({
  gpOptions,
  selectedGpId,
  onGpChange,
}: RankingFilterBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const label = gpOptions.find(g => g.id === selectedGpId)?.name ?? 'Geral';

  return (
    <div className="pb-3 max-w-4xl mx-auto">
      <div className="relative inline-block" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 bg-[#1f1f27] border border-white/5 rounded-xl px-4 py-3 text-xs font-black uppercase italic tracking-wider text-white transition-all"
        >
          {label}
          <ChevronDown size={16} className={`transition-transform duration-300 ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full mt-2 bg-[#1f1f27] border border-white/5 rounded-xl p-2 shadow-2xl min-w-56 max-h-80 overflow-y-auto z-50">
            <button
              onClick={() => { onGpChange(null); setMenuOpen(false); }}
              className={`w-full text-left whitespace-nowrap px-4 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all ${
                selectedGpId === null ? 'bg-[#e10600] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Geral
            </button>
            {gpOptions.map(g => (
              <button
                key={g.id}
                onClick={() => { onGpChange(g.id); setMenuOpen(false); }}
                className={`w-full text-left whitespace-nowrap px-4 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all ${
                  selectedGpId === g.id ? 'bg-[#e10600] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
