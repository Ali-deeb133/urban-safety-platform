// Public demo accounts for /api-docs, created by `npm run seed:demo`. The password comes from
// DEMO_ACCOUNTS_PASSWORD. The staff account works where the seed routes "Broken street light"
// reports in Mitte, so a report filed by the demo citizen there reaches the demo staff member.
export const DEMO_ACCOUNTS = {
  citizen: { email: 'demo.citizen@example.com', fullName: 'Demo Citizen' },
  staff: {
    email: 'demo.staff@example.com',
    fullName: 'Demo Staff',
    organizationName: 'Stromnetz Berlin',
    areaName: 'Mitte',
  },
} as const;

export const DEMO_STORY_CATEGORY = 'Broken street light';
