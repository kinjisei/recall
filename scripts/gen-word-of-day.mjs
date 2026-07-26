/**
 * Генератор компактного датасета «слово дня» (src/data/wordOfDay.ts).
 *
 * Раньше «слово дня» на Главной грузило ВЕСЬ словарь (~204КБ gzip) ради одного
 * слова. Здесь заранее отбираем ~40 слов на уровень на язык (равномерно по
 * темам) в крошечный файл (~10КБ gzip), который Главная и грузит лениво.
 * Формат записи короткий: {t: слово, r: перевод, e: пример, l: уровень}.
 *
 * Запуск: node scripts/gen-word-of-day.mjs  (перегенерировать после правки паков)
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const PER_LEVEL = 40
const ROOT = new URL('../src/data/', import.meta.url)

/** Годится ли слово в «слово дня»: короткое, одно-два слова, чистый перевод. */
function ok(term, translation) {
  if (!term || !translation) return false
  if (term.length > 24 || translation.length > 48) return false
  if (term.split(/\s+/).length > 2) return false
  // без спецсимволов/цифр в самом слове (слово дня должно смотреться опрятно)
  if (/[0-9()/·]/.test(term)) return false
  return true
}

/** Равномерная выборка n элементов из массива (по темам, а не первые подряд). */
function spread(arr, n) {
  if (arr.length <= n) return arr
  const step = arr.length / n
  const out = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)])
  return out
}

function collect(lang) {
  const dir = new URL(`${lang === 'es' ? 'spanish' : 'english'}/words/`, ROOT)
  const termKey = lang === 'es' ? 'spanish' : 'english'
  const exKey = lang === 'es' ? 'example_es' : 'example_en'
  const files = readdirSync(dir).filter(
    (f) => f.endsWith('.json') && !f.includes('idioms'), // идиомы — длинные фразы, не для «слова дня»
  )

  const byLevel = new Map()
  const seen = new Set()
  for (const f of files) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    } catch {
      continue
    }
    const words = Array.isArray(parsed) ? parsed : (parsed.words ?? [])
    for (const w of words) {
      const term = (w[termKey] ?? '').trim()
      const translation = (w.russian ?? '').trim()
      const level = w.level
      if (!level || !ok(term, translation)) continue
      const key = term.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const list = byLevel.get(level) ?? []
      list.push({ t: term, r: translation, e: (w[exKey] ?? '').trim() || undefined, l: level })
      byLevel.set(level, list)
    }
  }

  const out = []
  for (const [level, list] of [...byLevel.entries()].sort()) {
    const picked = spread(list, PER_LEVEL)
    out.push(...picked)
    console.log(`  ${lang} ${level}: ${list.length} → ${picked.length}`)
  }
  return out
}

console.log('Собираю «слово дня»…')
const en = collect('en')
const es = collect('es')

const body =
  '// ============================================================================\n' +
  '// СГЕНЕРИРОВАНО scripts/gen-word-of-day.mjs — НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n' +
  '// Компактный датасет «слова дня» для Главной: по ~40 слов на уровень, чтобы\n' +
  '// не грузить весь словарь (~204КБ) ради одного слова. Ленивый чанк.\n' +
  '// Перегенерировать: node scripts/gen-word-of-day.mjs\n' +
  '// ============================================================================\n' +
  'export interface WodEntry {\n' +
  '  /** слово */ t: string\n' +
  '  /** перевод */ r: string\n' +
  '  /** пример */ e?: string\n' +
  '  /** уровень CEFR */ l: string\n' +
  '}\n\n' +
  `export const wordOfDayEN: WodEntry[] = ${JSON.stringify(en)}\n\n` +
  `export const wordOfDayES: WodEntry[] = ${JSON.stringify(es)}\n`

const outPath = new URL('wordOfDay.ts', ROOT)
writeFileSync(outPath, body)
console.log(`\nEN ${en.length}, ES ${es.length} слов → src/data/wordOfDay.ts (${Math.round(body.length / 1024)}КБ)`)
