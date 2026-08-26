import { createClient } from '@supabase/supabase-js'

// Datos reales que te pasaron
const SUPABASE_URL = 'https://umeosmzuopgalcpuzbia.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_L51dE-V3GELYIky15oJeQg_zU8iWiRh'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)