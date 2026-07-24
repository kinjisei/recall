/**
 * Проверка примеров для режима «Пропущенное слово».
 *
 * Игра прячет слово в примере и предлагает выбрать его из четырёх вариантов.
 * Варианты — СЛОВАРНЫЕ формы, поэтому и в пропуске должна стоять словарная
 * форма. Старая регулярка `\bword\w*\b` ловила любую производную:
 *   retire + «My father retired at sixty.» → «My father ______ at sixty.»
 *   и «правильный» ответ retire — грамматически неверно (нужно retired).
 * Плюс она путала разные слова: art поймал бы article.
 *
 * Скрипт считает, сколько слов останется играбельными при строгом совпадении.
 * Запуск: node scripts/check-gap-examples.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'

const dirs = [
  ['EN', new URL('../src/data/english/words/', import.meta.url), 'english', 'example_en'],
  ['ES', new URL('../src/data/spanish/words/', import.meta.url), 'spanish', 'example_es'],
]

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const loose = (w) => new RegExp(`\\b${esc(w)}\\w*\\b`, 'i')
const exact = (w) => new RegExp(`\\b${esc(w)}\\b`, 'i')

for (const [label, dir, termKey, exKey] of dirs) {
  let total = 0
  let withExample = 0
  let looseOk = 0
  let exactOk = 0
  const broken = []
  const samples = []

  let files
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    console.log(`${label}: папка не найдена, пропускаю`)
    continue
  }

  for (const f of files) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    } catch {
      continue
    }
    // файлы паков — { topics: [...], words: [...] }
    const rows = Array.isArray(parsed) ? parsed : (parsed.words ?? [])
    if (!Array.isArray(rows)) continue
    for (const w of rows) {
      const term = (w[termKey] ?? '').trim()
      const ex = (w[exKey] ?? '').trim()
      if (!term) continue
      total++
      if (!ex) continue
      withExample++
      const l = loose(term).test(ex)
      const e = exact(term).test(ex)
      if (l) looseOk++
      if (e) exactOk++
      // играбельно по-старому, но форма в примере НЕ словарная — тут и вылезала
      // кривая грамматика
      if (l && !e && broken.length < 12) broken.push(`${term} — «${ex}»`)
      // как задание выглядит после правки: пропуск = ровно словарная форма
      if (e && samples.length < 5) {
        samples.push(`${ex.replace(exact(term), '______')}  → ${term}`)
      }
    }
  }

  const lost = looseOk - exactOk
  console.log(`\n=== ${label} ===`)
  console.log(`слов всего: ${total}, с примером: ${withExample}`)
  console.log(`играбельно при старой (любая форма): ${looseOk}`)
  console.log(`играбельно при строгой (словарная форма): ${exactOk}`)
  console.log(
    `потеряем: ${lost} (${withExample ? Math.round((lost / looseOk) * 100) : 0}% от играбельных)`,
  )
  if (broken.length) {
    console.log('примеры кривой грамматики (были играбельны зря):')
    for (const b of broken) console.log('  ' + b)
  }
  if (samples.length) {
    console.log('как выглядят задания теперь:')
    for (const s of samples) console.log('  ' + s)
  }
}
