// Sample data for the seed (Berlin). Names are real Berlin entities used as illustrative data;
// the routing below is a simplification, not official responsibility.
// Pure data: no imports, no logic. `prisma/seed.ts` reads it and upserts into the database.

export const AREAS = [
  'Mitte',
  'Friedrichshain-Kreuzberg',
  'Pankow',
  'Neukölln',
  'Charlottenburg-Wilmersdorf',
  'Tempelhof-Schöneberg',
] as const;

export type OrganizationTypeName = 'MUNICIPALITY' | 'TRANSPORT' | 'UTILITY' | 'OTHER';

export const ORGANIZATIONS: ReadonlyArray<{ name: string; type: OrganizationTypeName }> = [
  ...AREAS.map((area) => ({ name: `Bezirksamt ${area}`, type: 'MUNICIPALITY' as const })),
  { name: 'BSR', type: 'UTILITY' },
  { name: 'Berliner Wasserbetriebe', type: 'UTILITY' },
  { name: 'Stromnetz Berlin', type: 'UTILITY' },
  { name: 'BVG', type: 'TRANSPORT' },
];

export const CATEGORIES: ReadonlyArray<{ name: string; isEmergency: boolean }> = [
  { name: 'Pothole or damaged road', isEmergency: false },
  { name: 'Broken street light', isEmergency: false },
  { name: 'Water leak or burst pipe', isEmergency: false },
  { name: 'Illegal dumping or overflowing bins', isEmergency: false },
  { name: 'Damaged bus or tram stop', isEmergency: false },
  { name: 'Gas smell or fallen power line', isEmergency: true },
];

// Routing: one rule (priority 1, active) per non-emergency category x area.
// `null` means "the Bezirksamt of that area"; otherwise the organization name.
// The emergency category has no rule (it is rejected before routing).
export const RULE_OWNER_BY_CATEGORY: Readonly<Record<string, string | null>> = {
  'Pothole or damaged road': null,
  'Broken street light': 'Stromnetz Berlin',
  'Water leak or burst pipe': 'Berliner Wasserbetriebe',
  'Illegal dumping or overflowing bins': 'BSR',
  'Damaged bus or tram stop': 'BVG',
};
