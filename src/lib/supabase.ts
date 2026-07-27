import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey || anonKey.includes('ВСТАВЬ')) {
  // Понятное сообщение, если забыли вставить ключ в .env.local
  console.error(
    'Supabase не настроен: проверь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.local',
  )
}

// Клиент типизирован схемой БД (src/lib/database.types.ts, сгенерирован
// `supabase gen types`): .from('table') теперь знает форму строк, и расхождение
// «код ↔ база» ловится на сборке, а не у пользователя. ⚠️ После изменения
// schema.sql перегенерировать типы (см. docs/ARCHITECTURE.md).
export const supabase = createClient<Database>(url, anonKey)

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

/**
 * Мост «наш структурированный тип → Json» для записи в jsonb-колонку или
 * передачи аргументом RPC. База не ограничивает форму jsonb, а TypeScript не
 * может доказать, что произвольный объект сериализуем в JSON, — отсюда явный
 * мост. Использовать ТОЛЬКО для заведомо JSON-совместимых данных (наши PlanWeek,
 * ChatTurn, ответы упражнений и т.п.).
 */
export function toJson<T>(v: T): Json {
  return v as unknown as Json
}
