import { memo, useMemo } from 'react';
import { GridPosition } from './GridPosition';
import { GridCard } from './GridCard';
import { GridDropdown } from './GridDropdown';
import { GridDelta } from './GridDelta';
import { GridBadges } from './GridBadges';
import type { GridRowData, GridDriver } from '../types/grid';

interface GridRowProps {
  data: GridRowData;
  showDropdown?: boolean;
  showDelta?: boolean;
  showBadges?: boolean;
  availableDrivers?: GridDriver[];
  allDrivers?: GridDriver[];
  onDriverSelect?: (position: number, driver: GridDriver | null) => void;
}

const GridRow = memo(function GridRow({
  data,
  showDropdown,
  showDelta,
  showBadges,
  availableDrivers,
  allDrivers,
  onDriverSelect
}: GridRowProps) {
  const { position, driver, delta, badges, variant } = data;

  const groupedDrivers = useMemo(() => {
    if (!availableDrivers) return undefined;
    return availableDrivers.reduce<Record<string, GridDriver[]>>((acc, d) => {
      const team = d.team.name || 'Sem equipe';
      if (!acc[team]) acc[team] = [];
      acc[team].push(d);
      return acc;
    }, {});
  }, [availableDrivers]);

  return (
    <div className="flex w-full flex-row items-center gap-1 sm:gap-2 overflow-visible">
      <GridPosition position={position} />

      <GridCard driver={driver} variant={variant} />

      <GridDropdown
        showDropdown={showDropdown}
        position={position}
        groupedDrivers={groupedDrivers}
        allDrivers={allDrivers}
        onDriverSelect={onDriverSelect}
      />

      {showDelta && <GridDelta delta={delta} />}
      {showBadges && <GridBadges badges={badges} />}
    </div>
  );
});

export { GridRow };