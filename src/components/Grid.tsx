import { useMemo } from 'react';
import { GridRow } from './GridRow';
import type { GridRowData, GridDriver } from '../types/grid';

interface GridProps {
  rows: GridRowData[];
  allDrivers: GridDriver[];
  onDriverSelect: (position: number, driver: GridDriver | null) => void;
  showDropdown?: boolean;
  showDelta?: boolean;
  showBadges?: boolean;
  showTiming?: boolean;
  showTires?: boolean;
  rowGap?: string;
}

export function Grid({
  rows,
  allDrivers,
  onDriverSelect,
  showDropdown = true,
  showDelta = true,
  showBadges = true,
  showTiming = false,
  showTires = false,
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

  return (
    <div className={`flex flex-col w-full max-w-3xl mx-auto ${rowGap}`}>
      {(rows || []).map((row) => (
        <GridRow
          key={row.position}
          data={row}
          showDropdown={showDropdown}
          showDelta={showDelta}
          showBadges={showBadges}
          showTiming={showTiming}
          showTires={showTires}
          availableDrivers={availableDrivers}
          allDrivers={allDrivers}
          onDriverSelect={onDriverSelect}
        />
      ))}
    </div>
  );
}