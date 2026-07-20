/**
 * Валидатор данных упражнений: грамматика EN/ES, тренажёр окончаний,
 * неправильные глаголы, placement-тесты.
 * Проверяет структуру, а не языковую правильность:
 *   mcq  — answer-индекс в диапазоне options, options без дублей;
 *   fill — answer непустой; «(...)» в ответе — подозрение (пояснение в ответе);
 *   order — answer является перестановкой words (с учётом повторов).
 * Запуск: node scripts/validate-exercises.mjs   (выход 1, если есть ошибки)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const problems = []
const warn = []
let checked = 0

const norm = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')

function checkExercise(where, ex, i) {
  checked++
  const at = `${where} · упр.${i + 1} (${ex.type})`
  if (!ex.prompt?.trim()) problems.push(`${at}: пустой prompt`)
  if (ex.type === 'mcq') {
    if (!Array.isArray(ex.options) || ex.options.length < 2)
      problems.push(`${at}: options < 2`)
    else {
      if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= ex.options.length)
        problems.push(`${at}: answer-индекс ${ex.answer} вне options (${ex.options.length})`)
      // сверка mcq идёт по индексу, поэтому мешают только ТОЧНЫЕ дубли
      const trimmed = ex.options.map((o) => String(o).trim())
      if (new Set(trimmed).size !== trimmed.length)
        warn.push(`${at}: точные дубли в options [${ex.options.join(' | ')}]`)
    }
  } else if (ex.type === 'fill') {
    if (typeof ex.answer !== 'string' || !ex.answer.trim())
      problems.push(`${at}: пустой answer`)
    else if (/[()]/.test(ex.answer))
      warn.push(`${at}: скобки в answer «${ex.answer}» — пояснение попало в ответ?`)
  } else if (ex.type === 'order') {
    if (!Array.isArray(ex.words) || !Array.isArray(ex.answer))
      problems.push(`${at}: words/answer не массивы`)
    else {
      const a = ex.words.map(norm).sort()
      const b = ex.answer.map(norm).sort()
      if (a.length !== b.length || a.some((w, j) => w !== b[j]))
        problems.push(
          `${at}: answer не перестановка words — words=[${ex.words.join(' ')}], answer=[${ex.answer.join(' ')}]`,
        )
    }
  } else {
    problems.push(`${at}: неизвестный type «${ex.type}»`)
  }
}

// ---- грамматика: массивы тем в json-файлах ----
for (const dir of ['src/data/spanish/grammar', 'src/data/english/grammar']) {
  for (const file of readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.json'))) {
    const topics = JSON.parse(readFileSync(path.join(root, dir, file), 'utf8'))
    for (const topic of topics) {
      const where = `${dir}/${file} · «${topic.title}»`
      if (!Array.isArray(topic.exercises) || topic.exercises.length === 0)
        problems.push(`${where}: нет упражнений`)
      else topic.exercises.forEach((ex, i) => checkExercise(where, ex, i))
    }
  }
}

// ---- тренажёр окончаний (испанский): mcq-подобные ----
{
  const data = JSON.parse(
    readFileSync(path.join(root, 'src/data/spanish/endings_trainer.json'), 'utf8'),
  )
  const items = data.exercises ?? data
  items.forEach((ex, i) =>
    checkExercise('endings_trainer.json', { ...ex, type: 'mcq' }, i),
  )
}

// ---- placement-тесты (испанский и английский) ----
for (const file of ['src/data/spanish/placement_test.json', 'src/data/english/placement_test.json']) {
  const data = JSON.parse(readFileSync(path.join(root, file), 'utf8'))
  data.questions.forEach((q, i) => checkExercise(file, { ...q, type: 'mcq' }, i))
}

// ---- неправильные глаголы: три формы непустые, «/»-варианты корректны ----
{
  const src = readFileSync(path.join(root, 'src/data/english/irregular.ts'), 'utf8')
  const rows = [...src.matchAll(/\{\s*base:\s*'([^']*)',\s*past:\s*'([^']*)',\s*part:\s*'([^']*)',\s*ru:\s*'([^']*)'/g)]
  if (rows.length < 100) warn.push(`irregular.ts: распарсено только ${rows.length} глаголов — проверь регэксп`)
  for (const [, base, past, part, ru] of rows) {
    checked++
    for (const [name, v] of [['base', base], ['past', past], ['participle', part], ['ru', ru]]) {
      if (!v.trim()) problems.push(`irregular.ts · «${base}»: пустое поле ${name}`)
      if (v.includes('//') || v.startsWith('/') || v.endsWith('/'))
        problems.push(`irregular.ts · «${base}»: битые «/»-варианты в ${name}: «${v}»`)
    }
  }
}

console.log(`Проверено упражнений/записей: ${checked}`)
if (warn.length) {
  console.log(`\nПредупреждения (${warn.length}):`)
  warn.forEach((w) => console.log('  ⚠ ' + w))
}
if (problems.length) {
  console.log(`\nОШИБКИ (${problems.length}):`)
  problems.forEach((p) => console.log('  ✗ ' + p))
  process.exitCode = 1
} else {
  console.log('Ошибок структуры не найдено.')
}
