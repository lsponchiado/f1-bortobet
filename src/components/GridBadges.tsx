import { TrendingUp, TrendingDown, Swords } from 'lucide-react';
import type { BadgeType } from '../types/grid';

const badgeConfig: Record<BadgeType, { icon: React.ElementType; color: string }> = {
  HM: { icon: TrendingUp, color: 'text-yellow-400' },
  FF: { icon: TrendingDown, color: 'text-red-400' },
  UD: { icon: Swords, color: 'text-blue-400' },
};

export function GridBadges({ badges }: { badges?: BadgeType[] }) {
  const firstBadge = badges?.[0];
  const cfg = firstBadge ? badgeConfig[firstBadge] : null;
  const Icon = cfg?.icon;

  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-gray-800">
      {Icon && <Icon size={24} className={cfg.color} />}
    </div>
  );
}