import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError =
  url && key ? null : 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'

export const supabase = createClient<Database>(url || 'http://127.0.0.1:54321', key || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
