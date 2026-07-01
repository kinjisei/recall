import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey || anonKey.includes('ВСТАВЬ')) {
  // Понятное сообщение, если забыли вставить ключ в .env.local
  console.error(
    'Supabase не настроен: проверь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.local',
  )
}

export const supabase = createClient(url, anonKey)
