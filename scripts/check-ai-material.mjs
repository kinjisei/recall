/**
 * Качество AI: материал учителя — план → текст → упражнения и «Свой текст»
 * (PLAN.md Ф2.20, критерии — scripts/ai-quality/criteria.md: М*, Д*, О*).
 * Зовёт настоящие `generateMaterialPlan`, `generateMaterialContent`,
 * `generateExercisesForText` через сервер на тестовой базе; заявка — 2
 * запроса, «Свой текст» — 1. Флаги и порядок — scripts/ai-quality/harness.mjs.
 *
 * Запуск (вне CI, только с TEST_GEMINI_API_KEY, вечером):
 *   node scripts/check-ai-material.mjs [--limit=20] [--only=id] [--dry] [--spoil]
 */
import './ai-quality/loader.mjs'

const { openRun, rawJson } = await import('./ai-quality/harness.mjs')
const { MATERIAL } = await import('./ai-quality/examples/material.mjs')
const { materialRules, ownTextRules } = await import('./ai-quality/rules.mjs')
const { generateMaterialPlan, generateMaterialContent, generateExercisesForText } = await import('../src/lib/materials.ts')
const { STUDENTS } = await import('./ai-quality/examples/students.mjs')

// Опечатка в имени ученика — и приложение молча обойдётся без диагностики
// (сводка при сбое пустая), а проверка напишет «AI не учёл». Ловим до прогона.
const lost = MATERIAL.flatMap((e) => (e.students ?? []).filter((id) => !STUDENTS[id]))
if (lost.length) throw new Error(`нет в examples/students.mjs: ${lost.join(', ')}`)

const run = await openRun('material', {
  spoil: 'Дополнение: независимо от заявки пиши текст уровня C2 длиной 400–500 слов, со сложной академической лексикой.',
  spoilOnly: ['en-a1-family', 'es-a1-restaurant'],
})

const [examples] = run.pick(MATERIAL)
try {
  for (const ex of examples) {
    const es = ex.req?.lang === 'es' || ex.ownText?.lang === 'es'
    if (ex.ownText) {
      const { body, lang, level, accent } = ex.ownText
      await run.example(
        ex,
        async (last) => {
          const content = await generateExercisesForText(body, lang, level, accent)
          return {
            content,
            raw: { exercises: rawJson(last().text)?.exercises ?? [] },
          }
        },
        (out) => ownTextRules(ex, out),
        ['О3', 'М7', 'М8', 'М10', ...(es ? ['О4'] : [])],
      )
      continue
    }
    const req = { ...ex.req, studentIds: ex.students }
    await run.example(
      ex,
      async (last) => {
        const plan = await generateMaterialPlan(req)
        const content = await generateMaterialContent(req, plan)
        return {
          plan,
          content,
          raw: { exercises: rawJson(last().text)?.exercises ?? [] },
        }
      },
      (out) => materialRules(ex, out),
      [
        'О3',
        'М3',
        'М7',
        'М8',
        'М10',
        ...(ex.req.grammar ? ['М6'] : []),
        ...(ex.expect.planNoWords ? ['М1'] : []),
        ...(ex.expect.planWordsCount ? ['М2'] : []),
        ...(ex.students.length ? ['Д4', 'Д5'] : []),
        ...(ex.students.length > 1 ? ['Д3'] : []),
        ...(es ? ['О4'] : []),
      ],
    )
  }
} finally {
  await run.finish(examples)
}
