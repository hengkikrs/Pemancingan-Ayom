import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('⚠️  Supabase env vars missing. Copy .env.example to .env and fill in your credentials.')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')
