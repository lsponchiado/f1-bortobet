'use client';

import Link from 'next/link';
import { Trophy, User, LogOut, LayoutDashboard } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface NavbarProps {
  username: string;
}

export function Navbar({ username }: NavbarProps) {
  const handleLogout = async () => {
    try {
      const data = await signOut({ redirect: false, callbackUrl: '/login' });
      window.location.href = data.url;
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#15151e]/80 backdrop-blur-md border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-[#e10600] text-2xl font-black italic tracking-tighter uppercase">
            F1 BORT-BET
          </Link>

          <div className="hidden md:flex items-center gap-8 font-bold uppercase text-[11px] tracking-widest text-gray-400">
            <Link href="/" className="hover:text-white transition-colors text-white">Dashboard</Link>
            <Link href="/ranking" className="hover:text-white transition-colors">Ranking</Link>
            <Link href="/regras" className="hover:text-white transition-colors">Regulamento</Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 hidden sm:inline">@{username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-[#e10600] transition-colors p-1"
              title="Sair do sistema"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#1f1f27] border-t border-gray-800 py-3 px-8 flex justify-between items-center z-50">
        <Link href="/" className="text-[#e10600] flex flex-col items-center gap-1">
          <LayoutDashboard size={24} />
          <span className="text-[9px] font-bold uppercase">Home</span>
        </Link>
        <Link href="/ranking" className="text-gray-500 flex flex-col items-center gap-1">
          <Trophy size={24} />
          <span className="text-[9px] font-bold uppercase">Ranking</span>
        </Link>
        <Link href="/perfil" className="text-gray-500 flex flex-col items-center gap-1">
          <User size={24} />
          <span className="text-[9px] font-bold uppercase">Perfil</span>
        </Link>
      </div>

      <div className="h-20 md:h-24" />
    </>
  );
}
