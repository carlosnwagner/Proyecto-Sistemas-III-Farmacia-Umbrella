import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://umeosmzuopgalcpuzbia.supabase.co';
const supabaseAnonKey = 'sb_publishable_L51dE-V3GELYIky15oJeQg_zU8iWiRh';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);