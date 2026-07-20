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

/**
 * id текущего пользователя из локальной сессии (getSession не ходит в сеть).
 * null — если сессии нет. Раньше этот блок был скопирован в ~10 местах, где
 * при отсутствии сессии поведение расходилось.
 */
export async function currentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

/** Как currentUserId, но бросает — для операций, которым вход обязателен. */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId()
  if (!id) throw new Error('Нет авторизации')
  return id
}
