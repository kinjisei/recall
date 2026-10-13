/**
 * Качество AI: разбор сданной работы по материалу — черновик вердиктов для
 * учителя (PLAN.md Ф2.20, критерии — scripts/ai-quality/criteria.md: Р*, О*).
 * Зовёт настоящую `generateAiReview` через сервер на тестовой базе, 1 запрос
 * на пример. Авто-проверку ответов ученика считает настоящая сверка
 * приложения (`lib/text.ts`) — как у ученика. Флаги — scripts/ai-quality/harness.mjs.
 *
 * Запуск (вне CI, только с TEST_GEMINI_API_KEY, вечером):
 *   node scripts/check-ai-review.mjs [--limit=20] [--only=id] [--dry] [--spoil]
 */
import './ai-quality/loader.mjs'

const { openRun, rawJson } = await import('./ai-quality/harness.mjs')
const { REVIEW } = await import('./ai-quality/examples/review.mjs')
const { reviewRules } = await import('./ai-quality/rules.mjs')
const { generateAiReview } = await import('../src/lib/materials.ts')
const { answerMatches } = await import('../src/lib/text.ts')

const run = await openRun('review', {
  spoil: 'Дополнение: ok=true ставь только если ответ совпал с правильным буква в букву; комментарии пиши по-английски.',
  spoilOnly: ['en-b1-present-perfect', 'en-b2-all-correct'],
})

/** Что увидела бы авто-проверка у ученика (components/exercises.tsx: выбор — текст варианта, «собери» — слова через пробел). */
function autoOk(e, given) {
  if (e.type === 'mcq') return given === e.options[e.answer]
  if (e.type === 'order') return answerMatches(given, e.answer.join(' '))
  return answerMatches(given, e.answer)
}

const [examples] = run.pick(REVIEW)
try {
  for (const ex of examples) {
    const material = {
      id: ex.id,
      teacher_id: '',
      lang: ex.material.lang,
      level: ex.material.level,
      topic: '',
      format: '',
      length_range: '',
      title: null,
      body: ex.material.body,
      exercises: ex.items.map(([e]) => e),
      plan: null,
      created_at: '',
    }
    // не ответил — строки ответа нет вовсе, как у приложения
    const answers = ex.items.flatMap(([e, given], index) => (given === '' ? [] : [{ index, given, auto_ok: autoOk(e, given) }]))
    await run.example(
      ex,
      async (last) => {
        const review = await generateAiReview(material, { answers })
        return { review, raw: { items: rawJson(last().text)?.items ?? [] } }
      },
      (out) => reviewRules(ex, out),
      ['О3', 'О5', 'Р4', 'Р6', ...(ex.material.lang === 'es' ? ['О4'] : [])],
    )
  }
} finally {
  await run.finish(examples)
}
