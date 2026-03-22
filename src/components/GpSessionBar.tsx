'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { SESSION_LABELS, type SessionType } from '@/lib/constants';

interface GpOption {
  id: number;
  name: string;
}

interface SessionOption {
  id: number;
  type: string;
}

interface GpSessionBarProps {
  gpName: string;
  currentGpId: number;
  allGps: GpOption[];
  basePath: string;
  sessions: SessionOption[];
  activeSessionId: number | null;
  onSessionChange: (id: number) => void;
}

export function GpSessionBar({
  gpName,
  currentGpId,
  allGps,
  basePath,
  sessions,
  activeSessionId,
  onSessionChange,
}: GpSessionBarProps) {
  const router = useRouter();
  const [gpMenuOpen, setGpMenuOpen] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const gpMenuRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gpMenuRef.current && !gpMenuRef.current.contains(e.target as Node)) {
        setGpMenuOpen(false);
      }
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target as Node)) {
        setSessionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="pb-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        {/* GP Dropdown */}
        <div className="relative" ref={gpMenuRef}>
          <button
            onClick={() => setGpMenuOpen(!gpMenuOpen)}
            className="flex items-center gap-2 bg-[#1f1f27] border border-white/5 rounded-xl px-4 py-3 text-xs font-black uppercase italic tracking-wider text-white transition-all"
          >
            {gpName}
            <ChevronDown size={16} className={`transition-transform duration-300 ${gpMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {gpMenuOpen && (
            <div className="absolute left-0 top-full mt-2 bg-[#1f1f27] border border-white/5 rounded-xl p-2 shadow-2xl min-w-56 max-h-80 overflow-y-auto z-50">
              {allGps.map(g => {
                const isCurrent = g.id === currentGpId;
                return (
                  <button
                    key={g.id}
                    onClick={() => { router.push(`${basePath}/${g.id}`); setGpMenuOpen(false); }}
                    className={`w-full text-left whitespace-nowrap px-4 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all ${
                      isCurrent
                        ? 'bg-[#e10600] text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Session Dropdown */}
        <div className="relative" ref={sessionMenuRef}>
          <button
            onClick={() => setSessionMenuOpen(!sessionMenuOpen)}
            className="flex items-center gap-2 bg-[#1f1f27] border border-white/5 rounded-xl px-4 py-3 text-xs font-black uppercase italic tracking-wider text-white transition-all"
          >
            {SESSION_LABELS[activeSession?.type as SessionType] || 'Sessões'}
            <ChevronDown size={16} className={`transition-transform duration-300 ${sessionMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {sessionMenuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-[#1f1f27] border border-white/5 rounded-xl p-2 shadow-2xl min-w-48 z-50">
              {sessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { onSessionChange(s.id); setSessionMenuOpen(false); }}
                    className={`w-full text-left whitespace-nowrap px-4 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all ${
                      isActive
                        ? 'bg-[#e10600] text-white'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {SESSION_LABELS[s.type as SessionType] || s.type}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
