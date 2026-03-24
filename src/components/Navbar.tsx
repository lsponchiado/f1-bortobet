'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, User, LogOut, LayoutDashboard, BookOpen, Settings } from 'lucide-react';
import { signOut } from 'next-auth/react';
import pkg from '../../package.json';

interface NavbarProps {
  username: string;
  isAdmin?: boolean;
}

const navItems = [
  { href: '/',          label: 'Home',        icon: LayoutDashboard },
  { href: '/ranking',   label: 'Ranking',     icon: Trophy          },
  { href: '/regras',    label: 'Regulamento', icon: BookOpen        },
  { href: '/perfil',    label: 'Perfil',      icon: User            },
];

const adminItemDesktop = { href: '/admin', label: 'Configuração', icon: Settings };
const adminItemMobile  = { href: '/admin', label: 'Config.',      icon: Settings    };

export function Navbar({ username, isAdmin = false }: NavbarProps) {
  const pathname = usePathname();
  const handleLogout = () => signOut({ callbackUrl: '/login' });

  const desktopItems = isAdmin ? [...navItems, adminItemDesktop] : navItems;
  const mobileItems  = isAdmin ? [...navItems, adminItemMobile]  : navItems;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* Desktop top bar */}
      <nav className="fixed top-0 w-full z-50 bg-[#15151e]/80 backdrop-blur-md border-b border-gray-800 px-6 py-3 safe-top">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="inline-flex items-end gap-4 text-[#e10600] text-2xl font-black italic tracking-tighter uppercase leading-none">
            F1 BORTOBET
            <span className="text-[9px] font-bold tracking-wide text-gray-500 not-italic leading-none">v{pkg.version}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {desktopItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    active
                      ? 'bg-[#e10600]/10 text-[#e10600]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 hidden sm:inline">{username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-[#e10600] transition-colors p-1.5 rounded-lg hover:bg-white/5"
              title="Sair do sistema"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#1f1f27] border-t border-gray-800 py-2 px-2 flex justify-evenly items-center z-50 safe-bottom">
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-xl transition-all ${
                active ? 'text-[#e10600]' : 'text-gray-500'
              }`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="h-16 md:h-20 safe-top" />
    </>
  );
}
