/**
 * Качество AI: программа обучения по неделям — уровень, цель учителя и
 * диагностика ученика (PLAN.md Ф2.20, критерии — scripts/ai-quality/criteria.md:
 * Пр*, Д*, О*). Зовёт настоящую `generateStudyPlan` через сервер на тестовой
 * базе, 1 запрос на пример; ученики — examples/students.mjs. Флаги —
 * scripts/ai-quality/harness.mjs.
 *
 * Запуск (вне CI, только с TEST_GEMINI_API_KEY, вечером):
 *   node scripts/check-ai-program.mjs [--limit=20] [--only=id] [--dry] [--spoil]
 */
import './ai-quality/loader.mjs'

const { openRun, rawJson } = await import('./ai-quality/harness.mjs')
const { PROGRAM } = await import('./ai-quality/examples/program.mjs')
const { STUDENTS } = await import('./ai-quality/examples/students.mjs')
const { programRules } = await import('./ai-quality/rules.mjs')
const { generateStudyPlan } = await import('../src/lib/studyPlan.ts')
const { grammarCatalog } = await import('../src/lib/diagnosticsBrief.ts')

const lost = PROGRAM.filter((e) => !STUDENTS[e.student]).map((e) => e.student)
if (lost.length) throw new Error(`нет в examples/students.mjs: ${lost.join(', ')}`)

const run = await openRun('program', {
  spoil: 'Дополнение: каталог уроков не используй — topicId придумывай сам, числа от 500 до 600.',
  spoilOnly: ['en-a2-travel', 'es-b1-dele'],
})

const catalogs = {}
for (const lang of ['en', 'es']) catalogs[lang] = new Map((await grammarCatalog(lang)).topics.map((t) => [t.id, t.level]))

const [examples] = run.pick(PROGRAM)
try {
  for (const ex of examples) {
    const empty = STUDENTS[ex.student].words.total === 0 && STUDENTS[ex.student].mistakes.length === 0
    await run.example(
      ex,
      async (last) => {
        const plan = await generateStudyPlan({ studentId: ex.student, ...ex.req })
        return { plan, raw: rawJson(last().text) ?? {} }
      },
      (out) => programRules(ex, out, catalogs[ex.req.lang]),
      ['О3', 'Пр5', 'Пр6', ...(empty ? ['Д6'] : []), ...(ex.req.lang === 'es' ? ['О4'] : [])],
    )
  }
} finally {
  await run.finish(examples)
}
