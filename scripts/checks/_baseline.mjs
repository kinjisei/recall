// Общая механика списка «к исправлению» (baseline) для сторожей.
//
// Сторож считает нарушения как словарь «ключ → число» (сколько сырых цветов в
// файле, сколько строк в большом файле, есть ли запрещённый импорт). Список
// хранит то же самое на момент, когда сторож появился. Дальше:
//   • число выросло или ключ новый      → красный: это НОВОЕ нарушение;
//   • число уменьшилось или ключ пропал → тоже красный: кто-то исправил, и
//     список надо сузить (`npm run check:prune`), иначе освободившееся место
//     молча займёт следующее нарушение. Так же делает ESLint со своим списком.
//
// Режимы (последний аргумент командной строки сторожа):
//   --prune         сузить список до текущего состояния; НИКОГДА не расширяет
//   --allow <путь>  принять текущие числа для файлов под этим путём — только
//                   осознанно и с причиной в сообщении коммита (перенос файла,
//                   решение владельца)
//   --init          переписать список целиком — только при появлении сторожа
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

export const ROOT = new URL('../../', import.meta.url)
export const rootPath = (p) => new URL(p, ROOT)

/** «1 запись», «2 записи», «5 записей» — числительное с формой слова. */
export function plural(n, one, few, many) {
  const t = n % 100
  const u = n % 10
  const word = t >= 11 && t <= 14 ? many : u === 1 ? one : u >= 2 && u <= 4 ? few : many
  return `${n} ${word}`
}
const records = (n) => plural(n, 'запись', 'записи', 'записей')

/** Файл запущен как скрипт (node file.mjs), а не импортирован. */
export const isMain = (metaUrl) => Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === metaUrl

export function parseMode(argv = process.argv.slice(2)) {
  if (argv.includes('--prune')) return { kind: 'prune' }
  if (argv.includes('--init')) return { kind: 'init' }
  const i = argv.indexOf('--allow')
  if (i !== -1) {
    const paths = argv.slice(i + 1).filter((a) => !a.startsWith('--'))
    if (!paths.length) throw new Error('--allow: укажи путь файла или папки')
    return { kind: 'allow', paths: paths.map((p) => p.replace(/\\/g, '/').replace(/^\.\//, '')) }
  }
  return { kind: 'check' }
}

function readItems(file) {
  const url = rootPath(file)
  if (!existsSync(url)) return {}
  return JSON.parse(readFileSync(url, 'utf8')).items ?? {}
}

function writeItems(file, about, items) {
  const url = rootPath(file)
  mkdirSync(dirname(url.pathname.replace(/^\/([A-Za-z]:)/, '$1')), { recursive: true })
  const sorted = Object.fromEntries(Object.entries(items).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(url, JSON.stringify({ about, items: sorted }, null, 2) + '\n')
}

/**
 * Сравнить текущие нарушения со списком и напечатать итог.
 * @param {object} o
 * @param {string} o.name      имя сторожа для вывода
 * @param {string} o.file      путь списка от корня репозитория
 * @param {string} o.about     пояснение, которое пишется в сам список
 * @param {Record<string, number>} o.current  текущие нарушения
 * @param {(key: string, now: number, was: number) => string} o.describe  строка про нарушение
 * @param {boolean} [o.total]  печатать ли сумму чисел (для размера она бессмысленна)
 * @returns {boolean} true — зелёный
 */
export function settle({ name, file, about, current, describe, total = true, mode = parseMode() }) {
  const base = readItems(file)

  if (mode.kind === 'init') {
    writeItems(file, about, current)
    console.log(`${name}: список «к исправлению» записан заново — ${records(Object.keys(current).length)} (${file})`)
    return true
  }
  if (mode.kind === 'prune') {
    const next = {}
    for (const [k, was] of Object.entries(base)) next[k] = Math.min(was, current[k] ?? 0)
    const removed = Object.keys(base).filter((k) => !next[k]).length
    const lowered = Object.keys(base).filter((k) => next[k] && next[k] < base[k]).length
    writeItems(file, about, next)
    console.log(`${name}: список сужен — убрано ${removed}, уменьшено ${lowered}`)
    return true
  }
  if (mode.kind === 'allow') {
    const hit = (k) => mode.paths.some((p) => k === p || k.startsWith(p + '/') || k.startsWith(p + '#') || k.startsWith(p + ' '))
    const next = { ...base }
    let n = 0
    for (const k of new Set([...Object.keys(base), ...Object.keys(current)])) {
      if (hit(k) && next[k] !== (current[k] ?? 0)) {
        next[k] = current[k] ?? 0
        n++
      }
    }
    writeItems(file, about, next)
    console.log(`${name}: принято текущее состояние для ${mode.paths.join(', ')} — изменено: ${records(n)}`)
    return true
  }

  const added = []
  const stale = []
  for (const [k, now] of Object.entries(current)) if (now > (base[k] ?? 0)) added.push([k, now, base[k] ?? 0])
  for (const [k, was] of Object.entries(base)) if ((current[k] ?? 0) < was) stale.push([k, current[k] ?? 0, was])

  if (added.length) {
    console.log(`✖ ${name}: новые нарушения — ${added.length}:`)
    for (const [k, now, was] of added) console.log(`  ${describe(k, now, was)}`)
  }
  if (stale.length) {
    console.log(`✖ ${name}: исправлено: ${records(stale.length)} из списка «к исправлению» — сузь список: npm run check:prune`)
    for (const [k, now, was] of stale.slice(0, 10)) console.log(`  ${k}: было ${was}, стало ${now}`)
    if (stale.length > 10) console.log(`  … и ещё ${stale.length - 10}`)
  }
  if (!added.length && !stale.length) {
    const left = Object.values(base).reduce((s, n) => s + n, 0)
    const sum = total ? `, ${left} всего` : ''
    console.log(`✔ ${name}: новых нарушений нет (в списке «к исправлению»: ${records(Object.keys(base).length)}${sum})`)
    return true
  }
  return false
}

/** Строки файла: как `wc -l`, плюс последняя строка без перевода. */
export function countLines(text) {
  if (!text) return 0
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}
