/**
 * Качество AI: разбор письма (IELTS и эссе) и задания IELTS, которые AI
 * придумывает учителю (PLAN.md Ф2.20, критерии — scripts/ai-quality/criteria.md:
 * П*, О*). Зовёт настоящие `gradeWriting`, `generateChartTask`,
 * `generateIeltsQuestion` через сервер на тестовой базе, 1 запрос на пример.
 * Флаги — scripts/ai-quality/harness.mjs.
 *
 * Эталон балла — и официальные работы IELTS с баллом экзаменатора
 * (examples/official.mjs, тексты вне git): каждая в ±0,5 (П6), по набору —
 * без сдвига (П11, журнал п.77). `--only=official` — только они.
 *
 * Запуск (вне CI, только с TEST_GEMINI_API_KEY, вечером):
 *   node scripts/check-ai-writing.mjs [--limit=20] [--only=id|official] [--dry] [--spoil] [--model=…]
 *
 * Калибровка без квоты (Ф2.20-4): балл считает наш код, факты о работе уже в
 * answers.json прогона — пересчёт при текущих порогах и при вариантах, без
 * AI, базы и ключа (ai-quality/rescore.mjs):
 *   node scripts/check-ai-writing.mjs --rescore=<папка прогона> [--t7=0.3,0.4] [--t8=0.5,0.6] [--round=down,half]
 */
import './ai-quality/loader.mjs'

if (process.argv.some((a) => a.startsWith('--rescore='))) {
  const { rescoreCli } = await import('./ai-quality/rescore.mjs')
  process.exitCode = rescoreCli(process.argv.slice(2))
} else {
  await live()
}

/** Прогон на живой модели: сервер, тестовая база, ключ TEST_GEMINI_API_KEY. */
async function live() {
  // --only=official → номера всех официальных работ (до разбора флагов харнессом)
  const { OFFICIAL, OFFICIAL_MISSING } = await import('./ai-quality/examples/official.mjs')
  const onlyAt = process.argv.findIndex((a) => a === '--only=official')
  if (onlyAt !== -1) process.argv[onlyAt] = `--only=${OFFICIAL.map((e) => e.id).join(',')}`

  const { openRun, rawJson } = await import('./ai-quality/harness.mjs')
  const { WRITING, WRITING_TASKS } = await import('./ai-quality/examples/writing.mjs')
  const { writingRules, writingTaskRules } = await import('./ai-quality/rules.mjs')
  const { officialRules, biasRow } = await import('./ai-quality/rules-official.mjs')
  const { gradeWriting } = await import('../src/lib/writingGrade.ts')
  const { generateChartTask, generateIeltsQuestion } = await import('../src/lib/writing.ts')

  if (OFFICIAL_MISSING) console.warn('⚠ Нет scripts/ai-quality/official/essays.json — без официальных работ П11 не проверяется (README там же).')

  const run = await openRun('writing', {
    spoil: 'Дополнение: найди не меньше 15 ошибок — исправляй и верные фразы, если их можно сказать лучше; в focus верни 6 типов.',
    spoilOnly: ['en-b1-work', 'ielts-t2-7'],
  })

  const [essays, official, tasks] = run.pick(WRITING, OFFICIAL, WRITING_TASKS)
  const graded = []
  try {
    for (const ex of [...essays, ...official]) {
      const task = { id: ex.id, teacher_id: '', created_at: '', ...ex.task }
      const judge = [
        'О3',
        'О5',
        'П4',
        'П5',
        'П9',
        ...(task.settings?.ieltsTask === 'academic1' ? ['П7'] : []),
        ...(task.lang === 'es' ? ['О4'] : []),
      ]
      await run.example(
        ex,
        async (last) => {
          const grade = await gradeWriting(task, ex.essay, task.lang)
          if (ex.official !== undefined) graded.push({ id: ex.id, official: ex.official, band: grade.band })
          return { grade, raw: rawJson(last().text) ?? {} }
        },
        (out) => (ex.official !== undefined ? officialRules(ex, out) : writingRules(ex, out)),
        // официальные работы — без подложенных ошибок: судье только объяснения и фокус
        ex.official !== undefined ? ['О3', 'О5', 'П5', 'П9'] : judge,
      )
    }
    // ни одного ответа (квота) — итог «НЕПОЛНЫЙ» по пропущенным примерам, а не красный П11
    if (graded.length) {
      const bias = biasRow(graded)
      const s = bias.stats
      if (s) console.log(`Официальные работы: сдвиг ${s.bias.toFixed(2)}, разброс ${s.mae.toFixed(2)}, в ±0,5 — ${s.within} из ${s.n} (экзаменатор→AI: ${s.each})`)
      run.summary('official-set', 'Сдвиг балла по официальным работам IELTS', [bias])
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
    await run.finish([...essays, ...official, ...tasks])
  }
}
