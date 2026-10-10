import { createClient } from '@supabase/supabase-js';

import { env } from '../../config/env';

// One client is shared by every request, so it must never hold a user session.
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
