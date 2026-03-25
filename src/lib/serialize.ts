type DriverWithTeam = {
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
};

export function serializeDriver(d: DriverWithTeam) {
  return {
    id: d.id,
    lastName: d.lastName,
    code: d.code,
    number: d.number,
    headshotUrl: d.headshotUrl,
    team: { name: d.team.name, color: d.team.color, logoUrl: d.team.logoUrl },
  };
}
