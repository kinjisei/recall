// ============================================================================
// Сравнение ответов пользователя. Единое правило для всех режимов — иначе
// один и тот же ответ мог считаться верным в игре и неверным в грамматике.
// ============================================================================

/**
 * Нормализация ответа перед сравнением: без регистра, диакритики и лишних
 * пробелов. «Está» и «esta», «  Hello  world » и «hello world» — равны.
 */
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // диакритические знаки
    .replace(/\s+/g, ' ')
}

/**
 * Проверка ответа с поддержкой вариантов через «/»: answer «was/were»
 * принимает и «was», и «were». Каждый вариант сравнивается нормализованно.
 * Серверный пересчёт балла заданий (submit_material в schema.sql) обязан
 * считать так же — при изменении правила менять оба места.
 */
export function answerMatches(given: string, expected: string): boolean {
  const g = normalizeAnswer(given)
  return expected.split('/').some((variant) => normalizeAnswer(variant) === g)
}
