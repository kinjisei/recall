// ============================================================================
// Общие правила для ЛЮБОГО промпта, который исправляет текст ученика.
//
// Зачем отдельным файлом. Ревью качества AI (docs/mkt/20-review-2b-ai-quality.md)
// нашло две болезни в «Диалоге»: модель сдвигала время в исправлении («he don't
// like → he DIDN'T like» там, где было настоящее) и выдумывала ошибку в
// корректной фразе. Ошибка В ИСПРАВЛЕНИИ опаснее пропущенной — новичок её не
// перепроверит и запомнит неверно.
//
// Правила ниже проверены живьём (3 и 2 прогона соответственно, оба сценария
// из отчёта воспроизведены), поэтому их нельзя было оставить в одном экране:
// тем же самым занимаются ещё четыре промпта — квесты, два разбора письменных
// работ и AI-проверка упражнений. Общий текст держим ЗДЕСЬ, чтобы правки не
// расходились по копиям.
//
// Общий запрет «не выдумывай ошибки» в промптах уже был и не помогал: модель
// промахивалась не в правиле, а в конкретном разборе. Помогли именно ЭТАЛОНЫ —
// те самые фразы, на которых она споткнулась.
// ============================================================================

/** Не менять время и смысл: исправляем ошибку внутри фразы ученика. */
export const KEEP_TENSE_RULE =
  'NEVER change the tense, the time frame or the meaning of what the learner wrote: ' +
  'fix the mistake INSIDE their own sentence. A present-tense sentence stays present: ' +
  '"he don\'t like it" → "he doesn\'t like it", NEVER "he didn\'t like it"; ' +
  '"I am agree" → "I agree", NEVER "I agreed". If both a present and a past version ' +
  'are possible, show both: "he don\'t → he doesn\'t / he didn\'t (сейчас / в прошлом)".'

/** Не выдумывать ошибок там, где их нет. */
export const NO_INVENTED_MISTAKES_RULE =
  'Before writing a correction, check: is this fragment really WRONG in English? ' +
  'Leave alone anything that is already correct, even if you would have phrased the ' +
  'thought differently — e.g. "My sister works in a school too" is fully correct and ' +
  '"too" must NOT be removed. If you are not sure what the learner meant, do NOT ' +
  'correct it: ask a short question in Russian instead.'

/** Обе строки разом — для промптов, где нужны и та, и другая. */
export const CORRECTION_RULES = [KEEP_TENSE_RULE, NO_INVENTED_MISTAKES_RULE]

/**
 * Разбор не должен молча править больше, чем назвал.
 *
 * Замер ревью: в «улучшенной версии» исправлялись две ошибки из двенадцати,
 * которых не было в списке, — как раз согласование времён, то есть именно то,
 * что нужно объяснять. Порядок «сначала список, потом версия» задан явно,
 * потому что модель пишет линейно: так список физически не может отстать.
 */
export const LIST_BEFORE_REWRITE_RULE =
  'First write the COMPLETE list of mistakes, and only then the improved version. ' +
  'In the improved version change ONLY what you already listed. If while rewriting ' +
  'you notice another mistake, go back and add it to the list. Purely stylistic ' +
  'improvements must be shown as a separate line "стиль: было → стало", never applied ' +
  'silently.'
