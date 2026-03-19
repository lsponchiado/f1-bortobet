import { useMemo } from 'react';
import GridRow from './GridRow';
import type { GridRowData, GridDriver } from '../types/grid';

interface GridProps {
  rows: GridRowData[];
  allDrivers: GridDriver[];
  onDriverSelect: (position: number, driver: GridDriver | null) => void;
  showDropdown?: boolean;
  showDelta?: boolean;
  showBadges?: boolean;
  rowGap?: string;
}

export default function Grid({
  rows,
  allDrivers,
  onDriverSelect,
  showDropdown = true,
  showDelta = true,
  showBadges = true,
  rowGap = 'gap-2',
}: GridProps) {
  
  const availableDrivers = useMemo(() => {
    if (!allDrivers || allDrivers.length === 0) return [];

    const selectedIds = new Set(
      (rows || []).map(r => r.driver.id).filter(id => id > 0)
    );
    
    // Filtra os não selecionados e ordena em ordem alfabética pelo sobrenome
    return allDrivers
      .filter(d => !selectedIds.has(d.id))
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [rows, allDrivers]);

  const anyHasDelta = showDelta && rows.some(r => r.delta !== undefined);
  const anyHasBadges = showBadges && rows.some(r => r.badges && r.badges.length > 0);

  return (
    <div className={`flex flex-col w-full max-w-3xl mx-auto ${rowGap}`}>
      {(rows || []).map((row) => (
        <GridRow
          key={row.position}
          data={row}
          showDropdown={showDropdown}
          showDelta={anyHasDelta}
          showBadges={anyHasBadges}
          availableDrivers={availableDrivers}
          allDrivers={allDrivers}
          onDriverSelect={onDriverSelect}
        />
      ))}
    </div>
  );
}