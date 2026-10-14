import { z } from 'zod';

export const docsLoginSchema = z
  .object({
    email: z.email().toLowerCase(),
    password: z.string().min(1),
  })
  .strict();

export type DocsLoginInput = z.infer<typeof docsLoginSchema>;
