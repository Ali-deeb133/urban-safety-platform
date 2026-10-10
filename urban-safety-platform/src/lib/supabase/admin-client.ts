import { createClient } from '@supabase/supabase-js';

import { env } from '../../config/env';

// One client is shared by every request, so it must never hold a user session.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
