import { createClient } from '@supabase/supabase-js';
import { BASE_URL } from '@/config';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// anotha one
// Create Supabase client with site URL for auth redirects
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    // Uses config instead of hardcoded URL
    siteUrl: BASE_URL,
    // This fixes redirects after auth actions
    redirectTo: BASE_URL,
  }
});
