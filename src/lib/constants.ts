export type SessionType =
  | 'PRACTICE_1'
  | 'PRACTICE_2'
  | 'PRACTICE_3'
  | 'SPRINT_QUALIFYING'
  | 'QUALIFYING'
  | 'SPRINT'
  | 'RACE';

export const SESSION_LABELS: Record<SessionType, string> = {
  PRACTICE_1: 'Treino Livre 1',
  PRACTICE_2: 'Treino Livre 2',
  PRACTICE_3: 'Treino Livre 3',
  SPRINT_QUALIFYING: 'Classificação Sprint',
  QUALIFYING: 'Classificação',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

export const SESSION_LABELS_SHORT: Record<SessionType, string> = {
  PRACTICE_1: 'TL 1',
  PRACTICE_2: 'TL 2',
  PRACTICE_3: 'TL 3',
  SPRINT_QUALIFYING: 'Spr. Class.',
  QUALIFYING: 'Class.',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

/** Tamanho do grid de apostas por tipo de sessão */
export const GRID_SIZE = { RACE: 10, SPRINT: 8 } as const;

/** Interface compartilhada para itens de grid de aposta (usada em ranking, apostas, admin) */
export interface BetGridItem {
  position: number;
  driverId: number;
  lastName: string;
  code: string;
  number: number;
  headshotUrl: string | null;
  team: { name: string; color: string; logoUrl: string | null };
  fastestLap: boolean;
}

/** Resultado de corrida (view materializada) */
export interface RaceResultData {
  somaPos: number[];
  hailMary: number[];
  underdog: number[];
  freefall: number[];
  fastestLap: number;
  safetyCar: number;
  abandonos: number;
  somaTotal: number;
}

/** Resultado de sprint (view materializada) */
export interface SprintResultData {
  somaPos: number[];
  somaTotal: number;
}

/** Dados de aposta de um usuário para exibição no ranking modal */
export interface UserBetData {
  race: {
    grid: BetGridItem[];
    predictedSC: number;
    predictedDNF: number;
    doublePoints: boolean;
    result: RaceResultData | null;
  } | null;
  sprint: {
    grid: BetGridItem[];
    result: SprintResultData | null;
  } | null;
}
