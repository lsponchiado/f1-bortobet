// src/components/GridDropdown.tsx
import { ChevronDown } from 'lucide-react';
import type { GridDriver } from '../types/grid';

interface GridDropdownProps {
  showDropdown?: boolean;
  position: number;
  groupedDrivers?: Record<string, GridDriver[]>;
  allDrivers?: GridDriver[];
  // Ajustamos para aceitar GridDriver ou null (para limpar)
  onDriverSelect?: (position: number, driver: GridDriver | null) => void;
}

export function GridDropdown({ 
  showDropdown, 
  position, 
  groupedDrivers, 
  allDrivers, 
  onDriverSelect 
}: GridDropdownProps) {
  
  if (!showDropdown || !groupedDrivers || !allDrivers || !onDriverSelect) return null;

  return (
    <div className="relative h-16 w-10 shrink-0">
      <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-gray-800 text-white pointer-events-none">
        <ChevronDown size={20} />
      </div>
      <select
        onChange={(e) => {
          const val = e.target.value;
          
          if (val === 'clear') {
            onDriverSelect(position, null);
          } else {
            const selected = allDrivers.find(d => d.id === parseInt(val, 10));
            if (selected) onDriverSelect(position, selected);
          }
          
          e.target.value = '';
        }}
        defaultValue=""
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        <option value="" disabled hidden></option>
        
        {/* Opção de Limpar */}
        <option value="clear" className="text-red-500 font-bold">
          ❌ Limpar Posição
        </option>

        {Object.entries(groupedDrivers).map(([team, drivers]) => (
          <optgroup key={team} label={team}>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.lastName}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}