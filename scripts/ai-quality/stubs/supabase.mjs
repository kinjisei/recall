/**
 * Заглушка `src/shared/api/supabase.ts` для проверки качества AI (loader.mjs).
 * В базу из кода приложения проверка не ходит: AI-функции сами базу не
 * читают, диагностику подставляет stubs/diagnostics.mjs. Неожиданное чтение
 * таблицы — громкая ошибка, а не тихий пустой ответ. Аналитика (`rpc`)
 * молча проглатывается — как и в приложении при сбое.
 */
const UID = '00000000-0000-4000-8000-00000000a1a1'

export const supabase = {
  from(table) {
    throw new Error(`проверка качества AI не читает базу из кода приложения (таблица ${table})`)
  },
  rpc: async () => ({ data: null, error: null }),
  auth: { getSession: async () => ({ data: { session: null }, error: null }) },
}
export const currentUserId = async () => UID
export const requireUserId = async () => UID
export const toJson = (v) => v
