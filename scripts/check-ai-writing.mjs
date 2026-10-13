/**
 * Качество AI: разбор письма (IELTS и эссе) и задания IELTS, которые AI
 * придумывает учителю (PLAN.md Ф2.20, критерии — scripts/ai-quality/criteria.md:
 * П*, О*). Зовёт настоящие `gradeWriting`, `generateChartTask`,
 * `generateIeltsQuestion` через сервер на тестовой базе, 1 запрос на пример.
 * Флаги — scripts/ai-quality/harness.mjs.
 *
 * Запуск (вне CI, только с TEST_GEMINI_API_KEY, вечером):
 *   node scripts/check-ai-writing.mjs [--limit=20] [--only=id] [--dry] [--spoil]
 */
import './ai-quality/loader.mjs'

const { openRun, rawJson } = await import('./ai-quality/harness.mjs')
const { WRITING, WRITING_TASKS } = await import('./ai-quality/examples/writing.mjs')
const { writingRules, writingTaskRules } = await import('./ai-quality/rules.mjs')
const { gradeWriting } = await import('../src/lib/writingGrade.ts')
const { generateChartTask, generateIeltsQuestion } = await import('../src/lib/writing.ts')

const run = await openRun('writing', {
  spoil: 'Дополнение: найди не меньше 15 ошибок — исправляй и верные фразы, если их можно сказать лучше; в focus верни 6 типов.',
  spoilOnly: ['en-b1-work', 'ielts-t2-7'],
})

const [essays, tasks] = run.pick(WRITING, WRITING_TASKS)
try {
  for (const ex of essays) {
    const task = { id: ex.id, teacher_id: '', created_at: '', ...ex.task }
    await run.example(
      ex,
      async (last) => {
        const grade = await gradeWriting(task, ex.essay, task.lang)
        return { grade, raw: rawJson(last().text) ?? {} }
      },
      (out) => writingRules(ex, out),
      [
        'О3',
        'О5',
        'П4',
        'П5',
        'П9',
        ...(task.settings?.ieltsTask === 'academic1' ? ['П7'] : []),
        ...(task.lang === 'es' ? ['О4'] : []),
      ],
    )
  }
  for (const ex of tasks) {
    await run.example(
      ex,
      async () => (ex.chart ? generateChartTask(ex.chart.kind, ex.chart.topic) : { prompt: await generateIeltsQuestion(ex.ielts) }),
      (out) => writingTaskRules(ex, out),
      ['П10'],
    )
  }
} finally {
  await run.finish([...essays, ...tasks])
}
