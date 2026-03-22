export interface GridDriver {
  id: number;
  lastName: string;
  code: string;
  number: number;
  headshotUrl: string | null;
  team: {
    name: string;
    color: string;
    logoUrl: string | null;
  };
}

export type CardVariant = 'default' | 'green' | 'red' | 'purple';
export type BadgeType = 'HM' | 'FF' | 'UD';

export interface GridRowData {
  position: number;
  driver: GridDriver;
  delta?: number | string;
  badges?: BadgeType[];
  variant?: CardVariant;
  timing?: {
    gapToLeader: number | null;
    interval: number | null;
    bestLapTime: number | null;
  };
  tireStints?: string[];
  sectors?: { s1: number | null; s2: number | null; s3: number | null };
  speed?: number | null;
  drsOn?: boolean;
  pitStops?: PitStop[];
}

export interface PitStop {
  lap: number;
  duration: number | null;
}

export interface RaceControlMessage {
  date: string;
  category: string;
  flag?: string;
  message: string;
  driverNumber?: number;
}

export interface WeatherData {
  airTemperature: number | null;
  trackTemperature: number | null;
  humidity: number | null;
  rainfall: boolean;
  windSpeed: number | null;
}