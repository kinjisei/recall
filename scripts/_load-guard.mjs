/**
 * Нагрузка — только на ТЕСТОВУЮ базу (PLAN.md Ф2.12): куда можно лить 200
 * синтетических учеников и тысячи уроков — ОДНО место. Зовёт
 * check-load-lessons.mjs до первого запроса; тест — scripts/test-load-guard.mjs.
 *
 * Образец — scripts/_keys.mjs: чистая функция возвращает список бед, пустой —
 * можно. Пояса (каждый закрывает свою ошибку):
 *   1. --prod не принимается вовсе — у нагрузки нет «живого» режима;
 *   2. адрес тестовой базы есть, это https и *.supabase.co;
 *   3. это не живая база Recall: ref не равен зашитому PROD_REF (держит даже
 *      без VITE_SUPABASE_URL в .env.local) и не равен ref из VITE_SUPABASE_URL;
 *   4. публичный ключ тестовой ≠ ключ живой (одинаковые — один проект);
 *   5. человек подтвердил базу руками: --confirm=<ref тестовой базы>.
 * _env.mjs (dbTarget) сверяет TEST и VITE адреса тоже — здесь это повторено
 * нарочно: сторож нагрузки не должен зависеть от чужого кода.
 */

/** Живая база Recall (корневой CLAUDE.md, «Стек»). */
export const PROD_REF = 'qyvkyyjqqqirmdliddsn'

/** ref проекта Supabase из адреса или null, если адрес не Supabase. */
export function supabaseRef(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co')) return null
    return u.hostname.split('.')[0]
  } catch {
    return null
  }
}

/**
 * Что мешает лить нагрузку (список строк) — пустой: можно.
 * env — .env.local как объект (readEnv), argv — аргументы командной строки.
 * Ключи в текст бед не попадают.
 */
export function loadTargetProblems(env, argv) {
  const problems = []
  if (argv.includes('--prod')) problems.push('--prod не принимается: синтетическая нагрузка — только тестовая база')
  const url = env.TEST_SUPABASE_URL
  if (!url) {
    problems.push('Нет TEST_SUPABASE_URL в .env.local — без адреса тестовой базы нагрузку не запускаем')
    return problems
  }
  const ref = supabaseRef(url)
  if (!ref) {
    problems.push('TEST_SUPABASE_URL — не https://<ref>.supabase.co')
    return problems
  }
  if (ref === PROD_REF) problems.push('TEST_SUPABASE_URL указывает на ЖИВУЮ базу Recall')
  const prodRef = env.VITE_SUPABASE_URL ? supabaseRef(env.VITE_SUPABASE_URL) : null
  if (prodRef && prodRef === ref) problems.push('TEST_SUPABASE_URL совпадает с VITE_SUPABASE_URL (живой базой)')
  const testKey = env.TEST_SUPABASE_PUBLISHABLE_KEY
  if (testKey && env.VITE_SUPABASE_PUBLISHABLE_KEY && testKey === env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    problems.push('TEST_SUPABASE_PUBLISHABLE_KEY совпадает с ключом живой базы — это один проект')
  }
  const confirm = argv.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length)
  if (confirm !== ref) {
    problems.push(
      confirm
        ? `--confirm=${confirm} не совпадает с тестовой базой из TEST_SUPABASE_URL`
        : `Подтверди базу руками: --confirm=${ref} (ref тестовой базы из TEST_SUPABASE_URL)`,
    )
  }
  return problems
}
