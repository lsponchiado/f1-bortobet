import type { GridDriver, CardVariant } from '../types/grid';

interface GridCardProps {
  driver: GridDriver;
  variant?: CardVariant;
}

const variantClass: Record<CardVariant, string> = {
  default: 'bg-gray-700',
  green: 'bg-green-700',
  red: 'bg-red-700',
  purple: 'bg-purple-700',
};

export function GridCard({ driver, variant = 'default' }: GridCardProps) {
  // Verifica se está vazio ou se é o placeholder (id < 0)
  const isEmpty = !driver || driver.id < 0;

  return (
    // O container principal é sempre o mesmo, mantendo a responsividade impecável
    <div className={`@container flex flex-1 h-16 min-w-44 max-w-80 overflow-hidden rounded-sm text-white shadow-lg border border-white/5 ${isEmpty ? 'bg-gray-700' : variantClass[variant]}`}>
      
      {/* Só renderiza o recheio se NÃO estiver vazio */}
      {!isEmpty && (
        <>
          <div 
            className="flex h-16 w-16 shrink-0 items-center justify-center" 
            style={{ backgroundColor: driver.team?.color || '#333' }}
          >
            {driver.team?.logoUrl && (
              <img src={driver.team.logoUrl} alt={driver.team.name} className="h-full object-contain p-2" />
            )}
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden px-2 text-3xl font-black uppercase italic tracking-tighter">
            <span className="truncate pr-2 @[15rem]:hidden">{driver.code}</span>
            <span className="hidden truncate pr-2 @[15rem]:block">{driver.lastName}</span>
          </div>
        </>
      )}
      
    </div>
  );
}