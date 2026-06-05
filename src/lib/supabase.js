import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://yxizhqfkajznbdigfxho.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_z46OvX0cINRlXUEuMkW11A_3sxue2Xu'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
