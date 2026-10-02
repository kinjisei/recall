/**
 * Ключи Supabase: какой куда класть — ОДНО место (PLAN.md Ф1.9). Зовут сборка
 * (vite.config.ts) и скрипты (_env.mjs); тест — scripts/test-keys.mjs.
 *
 * С Ф1.9 только новые ключи: `sb_publishable_…` — публичный, уходит в бандл
 * каждому ученику (VITE_SUPABASE_PUBLISHABLE_KEY); `sb_secret_…` — всё в обход
 * RLS, только скриптам на своей машине (SUPABASE_SECRET_KEY). Старые
 * JWT-ключи anon/service_role Supabase выключает к концу 2026.
 *
 * ⚠️ Всё, что начинается с VITE_, Vite вшивает в бандл. Секретный ключ в такой
 * переменной — данные всех учеников в открытом доступе. Поэтому сборка
 * проверяет КАЖДУЮ VITE_-переменную, а не только ту, где ключ ждём.
 */

export const PUBLISHABLE = 'sb_publishable_'
export const SECRET = 'sb_secret_'

/** Роль из старого JWT-ключа Supabase или null, если это не JWT. */
function legacyRole(value) {
  if (!value.startsWith('eyJ')) return null
  try {
    return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role ?? '?'
  } catch {
    return '?'
  }
}

/**
 * Что не так с ключом (строка) или null. kind — 'publishable' | 'secret'.
 * Значение ключа в текст ошибки не попадает.
 */
export function keyProblem(name, value, kind) {
  const prefix = kind === 'secret' ? SECRET : PUBLISHABLE
  if (!value) return `${name}: пусто`
  if (value.startsWith(prefix)) return null
  const role = legacyRole(value)
  if (role) return `${name}: старый ключ ${role} (JWT) — нужен ${prefix}…, старые выключены (Ф1.9)`
  if (value.startsWith(SECRET)) return `${name}: секретный ключ там, где нужен публичный ${PUBLISHABLE}…`
  return `${name}: не похоже на ключ Supabase — ждём ${prefix}…`
}

/**
 * Проверка окружения сборки. Список бед; пустой — можно собирать.
 * onVercel — сборка для пользователей: без адреса и ключа приложение белое,
 * а серверные функции молча отвечают «требуется вход». Пусть лучше упадёт
 * сборка: Vercel тогда оставит в проде прежнюю рабочую версию. Локально и в
 * CI (проверки без .env) отсутствие ключа — не беда.
 */
export function buildEnvProblems(env, { onVercel }) {
  const problems = []
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_') || !value) continue
    if (value.startsWith(SECRET) || legacyRole(value) === 'service_role') {
      problems.push(`${name}: секретный ключ в VITE_-переменной — уйдёт в бандл каждому`)
    }
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (key) {
    const p = keyProblem('VITE_SUPABASE_PUBLISHABLE_KEY', key, 'publishable')
    if (p && !problems.some((x) => x.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY'))) problems.push(p)
  } else if (onVercel) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY не задан в Vercel → Settings → Environment Variables')
  }
  if (onVercel && !env.VITE_SUPABASE_URL) problems.push('VITE_SUPABASE_URL не задан в Vercel')
  return problems
}
