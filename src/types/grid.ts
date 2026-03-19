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
}