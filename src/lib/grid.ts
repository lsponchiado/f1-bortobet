import type { GridDriver } from '@/types/grid';

export function placeholderDriver(position: number): GridDriver {
  return {
    id: -position,
    lastName: '???',
    code: '???',
    number: 0,
    headshotUrl: null,
    team: { name: '', color: '#333', logoUrl: null },
  };
}
