/**
 * Чистый тест миграций supabase/migrations (PLAN.md Ф1.2). Без сети и базы.
 *
 * Три правила, нарушение каждого уже стоило нам дыры или часов поиска:
 *   1. Имена NNNN_имя.sql, номера подряд с 0000. CLI применяет файлы по
 *      порядку имён: пропуск или дубль номера — миграция уедет не туда.
 *   2. Каждая миграция ЗАКАНЧИВАЕТСЯ блоком-страховкой, дословно как в
 *      baseline. Права по умолчанию (0001) уже закрывают новые функции от
 *      анонима, а блок — второй пояс: без него функция, созданная не той
 *      ролью или пересозданная через drop + create, осталась бы открытой
 *      (так жили choose_homework_item и submit_word_check).
 *   3. Baseline не правится никогда: он сверен с живой базой (0 расхождений),
 *      и любая правка в нём — это изменение, которого нет на проде. Всё
 *      новое — следующей миграцией. Отпечаток прибит ниже ЛИТЕРАЛОМ.
 *
 * Запуск: node scripts/test-migrations.mjs
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../supabase/migrations/', import.meta.url)
// Переводы строк приводим к LF: git на Windows отдаёт CRLF, CI — LF.
const read = (f) => readFileSync(new URL(f, dir), 'utf8').replace(/\r\n/g, '\n')

// sha256 файла 0000_baseline.sql с LF. Менять нельзя — см. правило 3.
const BASELINE_SHA256 = '0cb40300e7027ab63ab561f2723921cff6ee44de9d2e7d394bf39aef2c94ef61'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

// --- 1. имена и порядок ------------------------------------------------------------
const badNames = files.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f))
check('имена миграций — NNNN_имя.sql (строчные, цифры, _)', badNames.length === 0, badNames.join(', '))
const numbers = files.map((f) => Number(f.slice(0, 4)))
const gaps = numbers.filter((n, i) => n !== i)
check(
  'номера идут подряд с 0000, без пропусков и дублей',
  files.length > 0 && gaps.length === 0,
  `номера: ${numbers.join(', ')}`,
)
check('первая миграция — 0000_baseline.sql', files[0] === '0000_baseline.sql', files[0] ?? 'нет файлов')

// --- 2. блок-страховка в конце каждой ----------------------------------------------
const HARDEN_START = 'do $harden$\n'
const baseline = files.includes('0000_baseline.sql') ? read('0000_baseline.sql') : ''
const canonical = baseline.slice(baseline.lastIndexOf(HARDEN_START)).trimEnd()
check(
  'в baseline есть блок-страховка, и в нём исключён только track_event',
  canonical.startsWith(HARDEN_START) && /p\.proname <> 'track_event'/.test(canonical),
)
for (const f of files) {
  const text = read(f)
  const at = text.lastIndexOf(HARDEN_START)
  const tail = at < 0 ? '' : text.slice(at).trimEnd()
  check(`${f}: заканчивается блоком-страховкой, дословно как в baseline`, at >= 0 && tail === canonical,
    at < 0 ? 'блока нет' : 'после блока что-то есть или блок изменён')
}

// --- 3. baseline не правится ----------------------------------------------------------
const sha = createHash('sha256').update(baseline).digest('hex')
check(
  '0000_baseline.sql не изменён (сверен с живой базой) — новое пишется следующей миграцией',
  sha === BASELINE_SHA256,
  `отпечаток ${sha.slice(0, 12)}…`,
)

const failed = results.filter((ok) => !ok).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exitCode = failed ? 1 : 0
