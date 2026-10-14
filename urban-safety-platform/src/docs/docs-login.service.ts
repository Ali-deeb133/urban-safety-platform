import { createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { UnauthorizedError } from '../errors/unauthorized-error';
import type { DocsLoginInput } from './docs-login.validation';

// Its own client, not the shared supabaseAnon, so a sign-in here can never touch the API's client.
const docsSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface DocsLoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

// Swagger has no frontend to sign in with, so this trades credentials for the same Supabase
// access token the real frontend gets. The API never calls it.
export async function loginForDocs(input: DocsLoginInput): Promise<DocsLoginResult> {
  const { data, error } = await docsSupabase.auth.signInWithPassword(input);

  if (error) {
    if (error.code === 'email_not_confirmed') {
      throw new UnauthorizedError('Email not confirmed yet', 'EMAIL_NOT_CONFIRMED');
    }
    if (error.code === 'invalid_credentials') {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    throw error;
  }

  return {
    accessToken: data.session.access_token,
    tokenType: 'Bearer',
    expiresIn: data.session.expires_in,
  };
}
