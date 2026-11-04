#!/usr/bin/env node
// Сторож секретов (PLAN.md Ф2.26): ключ, пароль или файл окружения не уходят
// в git. Пока репозиторий открытый, утёкший ключ ловит сканирование GitHub;
// у приватного бесплатного сканирования нет — ловит этот сторож, до коммита.
// Из истории git ключ не стирается: попал в коммит — меняй его у поставщика.
//
// Что ловит:
//   • файлы по имени: .env, .env.local, .envrc… (кроме .env.example), файлы
//     ключей (.pem, .key, .p12, .pfx, .jks, .keystore, id_rsa…);
//   • ключи по формату: sb_secret_ (Supabase), sbp_ (токен Management API
//     Supabase), AIza… (Google AI), gsk_ (Groq), старый JWT-ключ с ролью
//     service_role, приватный ключ PEM, адрес postgres:// с паролем;
//   • значение у переменной-секрета: VAPID_PRIVATE_KEY=…, NOTIFY_SECRET: '…',
//     …_PASSWORD, …_ACCESS_TOKEN, …_API_KEY.
//
// Как отличить ключ от примера в документе. Ключ — это ПОЛНОЕ значение
// нужного формата, похожее на случайное. Пример — нет:
//   • приставка без значения или с многоточием: `sb_secret_…`, `AIza…`,
//     «ключ sb_secret_» — формату не хватает длины;
//   • заглушка: <ключ>, [YOUR-PASSWORD], xxxx, ${{ secrets.X }},
//     process.env.X — значения нет или оно не из знаков ключа;
//   • выдуманное слово или ряд: your_key_here, test-secret-123, abcdefgh…,
//     ZyXwVu — в случайной строке нет слов example/test/your…, рядов из 5
//     букв или цифр подряд, 4 одинаковых знака подряд, а знаки — минимум
//     двух видов из трёх (строчные, заглавные, цифры);
//   • publishable-ключ (sb_publishable_…) и JWT с ролью anon — публичные, их
//     и так получает браузер каждого ученика;
//   • слово service_role само по себе (грант в SQL, текст) — не ключ: ключ —
//     это JWT, у которого внутри role = service_role.
// Значение найденного ключа сторож не печатает — только вид и длину.
//
// Где ищет:
//   node scripts/checks/secrets.mjs            файлы в git и новые, которые
//                                              возьмёт `git add -A` (не в .gitignore)
//   node scripts/checks/secrets.mjs --staged   то, что уходит в коммит, — версия
//                                              в индексе (хук pre-commit)
// Двоичные файлы (картинки) — только по имени. Списка «к исправлению» нет:
// найденный секрет не ждёт переезда, его убирают сразу.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isMain, plural, rootPath } from './_baseline.mjs'

// fileURLToPath, а не .pathname: в пути с пробелом или кириллицей pathname
// закодирован (%20, %D0…), такой папки нет — и git падает с ENOENT
const cwd = fileURLToPath(rootPath('.'))

// ── файлы по имени ───────────────────────────────────────────────────────────

/** Что не так с самим файлом (по имени) или null. */
export function pathProblem(path) {
  const name = path.split('/').pop()
  if (/^\.env(rc)?(\..+)?$/.test(name) && name !== '.env.example') {
    return 'файл окружения (.env*) — в git не кладётся: ключи живут на своей машине и в переменных Vercel, в git — только .env.example с пустыми значениями'
  }
  if (/\.(pem|key|p12|pfx|jks|keystore)$/i.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name)) {
    return 'файл ключа (подпись, TLS, SSH) — в git не кладётся (ключ подписи TWA — тоже)'
  }
  return null
}

// ── похоже ли значение на настоящий секрет ───────────────────────────────────

// «xxxx» ловит правило «4 одинаковых подряд»; слово короче 4 букв в случайной
// строке встречается слишком часто (xxx — у каждого тысячного ключа Google)
const PLACEHOLDER = /example|sample|placeholder|your|dummy|fake|test|changeme|redacted|[<>[\]{}…*]|\.\.\./i

/** Ряд из 5 знаков подряд по алфавиту или цифрам: abcde, 12345, zyxwv. */
function hasSequence(s) {
  const t = s.toLowerCase()
  let up = 1
  let down = 1
  for (let i = 1; i < t.length; i++) {
    const d = t.charCodeAt(i) - t.charCodeAt(i - 1)
    up = d === 1 ? up + 1 : 1
    down = d === -1 ? down + 1 : 1
    if (up >= 5 || down >= 5) return true
  }
  return false
}

/**
 * Случайная ли строка (часть ключа после приставки, значение переменной).
 * Настоящий ключ — случайные знаки: в нём нет слов-заглушек и рядов, знаков
 * минимум двух видов, разных знаков — не меньше четверти длины.
 */
export function looksRandom(s, minLength = 12) {
  if (s.length < minLength) return false
  if (PLACEHOLDER.test(s) || /(.)\1{3}/.test(s) || hasSequence(s)) return false
  const kinds = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(s)).length
  return kinds >= 2 && new Set(s).size >= Math.max(6, Math.ceil(s.length / 4))
}

// ── правила по содержимому ───────────────────────────────────────────────────

/** Роль из JWT (вторая часть — JSON в base64url) или null. */
function jwtRole(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).role ?? null
  } catch {
    return null
  }
}

// Граница ключа: до и после — не знак ключа (иначе AIza найдётся внутри
// base64 картинки в макете).
const B = '(?<![A-Za-z0-9_-])'
const E = '(?![A-Za-z0-9_-])'
const chars = (n) => plural(n, 'знак', 'знака', 'знаков')
const SECRET_NAME = '[A-Z][A-Z0-9_]*(?:SECRET|PRIVATE_KEY|PASSWORD|ACCESS_TOKEN|API_KEY)[A-Z0-9_]*'
const VALUE = "[A-Za-z0-9_\\-+/=!@#%^&~]{12,}"

/**
 * Правила: re — где искать (флаг g), secret(m) — часть совпадения, которая
 * должна выглядеть случайной (null — не секрет; raw — уже проверена самим
 * правилом), what(m) — что сказать.
 * Формат Supabase: sb_secret_<22 случайных>_<8 контрольных> (документация
 * self-hosting); Groq, Google, sbp_ — как у trufflehog и gitleaks.
 */
export const RULES = [
  {
    re: new RegExp(`${B}sb_secret_([A-Za-z0-9_-]{20,})${E}`, 'g'),
    secret: (m) => m[1],
    what: (m) => `секретный ключ Supabase (sb_secret_…, ${chars(m[0].length)})`,
  },
  {
    re: new RegExp(`${B}sbp_([a-z0-9]{40})${E}`, 'g'),
    secret: (m) => m[1],
    what: () => 'токен Management API Supabase (sbp_…)',
  },
  {
    re: new RegExp(`${B}AIza([A-Za-z0-9_-]{35})${E}`, 'g'),
    secret: (m) => m[1],
    what: () => 'ключ Google AI (AIza…, 39 знаков)',
  },
  {
    re: new RegExp(`${B}gsk_([A-Za-z0-9]{52})${E}`, 'g'),
    secret: (m) => m[1],
    what: () => 'ключ Groq (gsk_…, 56 знаков)',
  },
  {
    // старый ключ Supabase — JWT; секрет только тот, у кого role = service_role
    re: new RegExp(`${B}eyJ[A-Za-z0-9_-]{10,}\\.(eyJ[A-Za-z0-9_-]{10,})\\.([A-Za-z0-9_-]{20,})${E}`, 'g'),
    secret: (m) => (jwtRole(m[1]) === 'service_role' ? m[2] : null),
    what: () => 'старый ключ Supabase service_role (JWT)',
  },
  {
    // тело — base64 между BEGIN и END, в том числе внутри JSON (с \n); в
    // длинном base64 слова-заглушки встречаются случайно — поэтому raw
    raw: true,
    re: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----([\s\S]{64,}?)-----END[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/g,
    secret: (m) => {
      const body = m[1].replace(/\\[nr]/g, '\n').replace(/^[A-Za-z-]+:.*$/gm, '').replace(/\s/g, '')
      return /^[A-Za-z0-9+/=]{64,}$/.test(body) ? body : null
    },
    what: () => 'приватный ключ PEM',
  },
  {
    // пароль в адресе базы; в настоящем адресе @ в пароле записан как %40
    re: /postgres(?:ql)?:\/\/[^\s:@/'"`]+:([^\s@/'"`]+)@[^\s'"`]+/g,
    raw: true,
    secret: (m) => (looksRandom(m[1], 8) ? m[1] : null),
    what: () => 'адрес базы postgres:// с паролем',
  },
  {
    // в коде — значение в кавычках: const X_SECRET = '…', "X_API_KEY": "…"
    re: new RegExp(`\\b(${SECRET_NAME})["']?\\s*[:=]\\s*(["'\`])(${VALUE})\\2`, 'g'),
    secret: (m) => m[3],
    what: (m) => `значение у переменной ${m[1]} (${chars(m[3].length)})`,
  },
  {
    // в .env и YAML — строка «ИМЯ=значение» / «ИМЯ: значение» без кавычек
    re: new RegExp(`^[ \\t]*(?:export[ \\t]+)?(${SECRET_NAME})[ \\t]*[:=][ \\t]*(${VALUE})[ \\t]*(?:#.*)?$`, 'gm'),
    secret: (m) => m[2],
    what: (m) => `значение у переменной ${m[1]} (${chars(m[2].length)})`,
  },
]

/**
 * Секреты в тексте: [{ line, what }], по одной находке на строку (первое
 * подходящее правило). Значение ключа в находку не попадает.
 */
export function findSecrets(text) {
  const src = text.replace(/\r\n?/g, '\n')
  const starts = [0]
  for (let i = src.indexOf('\n'); i !== -1; i = src.indexOf('\n', i + 1)) starts.push(i + 1)
  const lineAt = (pos) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
  const found = new Map()
  for (const rule of RULES) {
    for (const m of src.matchAll(rule.re)) {
      const part = rule.secret(m)
      // у правил с приставкой случайной должна быть часть после неё
      if (part === null || (!rule.raw && !looksRandom(part, 8))) continue
      const line = lineAt(m.index)
      if (!found.has(line)) found.set(line, rule.what(m))
    }
  }
  return [...found].sort(([a], [b]) => a - b).map(([line, what]) => ({ line, what }))
}

// ── файлы ────────────────────────────────────────────────────────────────────

const git = (...args) => execFileSync('git', args, { cwd, maxBuffer: 256 << 20 })
const list = (buf) => buf.toString('utf8').split('\0').filter(Boolean)
/** Двоичный файл — как у git: ноль в первых 8000 байтах. */
const isBinary = (buf) => buf.subarray(0, 8000).includes(0)

/** Проблемы файла: [строка отчёта]. */
export function fileProblems(path, buf) {
  const out = []
  const byName = pathProblem(path)
  if (byName) out.push(`${path} — ${byName}`)
  if (buf && !isBinary(buf)) for (const { line, what } of findSecrets(buf.toString('utf8'))) out.push(`${path}:${line} — ${what}`)
  return out
}

function stagedFiles() {
  return list(git('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR')).map((path) => ({
    path,
    read: () => git('show', `:${path}`), // версия в индексе — то, что уйдёт в коммит
  }))
}

function workingFiles() {
  const tracked = list(git('ls-files', '-z'))
  const fresh = new Set(list(git('ls-files', '-z', '--others', '--exclude-standard')))
  return [...new Set([...tracked, ...fresh])].map((path) => ({
    path,
    fresh: fresh.has(path),
    read: () => {
      const full = join(cwd, path)
      return existsSync(full) ? readFileSync(full) : null // удалён, но ещё в git
    },
  }))
}

if (isMain(import.meta.url)) {
  const staged = process.argv.includes('--staged')
  const files = staged ? stagedFiles() : workingFiles()
  const problems = []
  let read = 0
  let freshHit = false
  let nameHit = false
  for (const f of files) {
    const buf = f.read()
    if (buf) read++
    const p = fileProblems(f.path, buf)
    if (p.length && f.fresh) freshHit = true
    if (pathProblem(f.path)) nameHit = true
    problems.push(...p)
  }
  const where = staged ? 'в коммите' : 'в git и новых файлах'
  if (files.length && !read) {
    // ни одного файла не прочитать — сломан путь, а не «секретов нет»
    console.log(`✖ секреты: не прочитан ни один из ${plural(files.length, 'файла', 'файлов', 'файлов')} (${cwd}) — проверять нечего, сторож сломан`)
    process.exitCode = 1
  } else if (!problems.length) {
    console.log(`✔ секреты: ${plural(files.length, 'файл', 'файла', 'файлов')} ${where} — ключей и файлов окружения нет`)
  } else {
    console.log(`✖ секреты: найдено ${problems.length} ${where}:`)
    for (const p of problems) console.log(`  ${p}`)
    console.log('  Убери значение из файла: ключи — в .env.local, на сервере — в переменных Vercel.')
    if (nameHit) console.log('  Файл окружения или ключа — убери из индекса: git rm --cached <файл> и впиши его в .gitignore.')
    if (freshHit) console.log('  Новый файл ещё не в git, но не в .gitignore — `git add -A` его добавит.')
    console.log('  Если ключ уже был в коммите или в чате — замени его у поставщика: из истории git он не стирается.')
    console.log('  Ложная тревога (пример в документе) — пиши пример с многоточием: sb_secret_…, AIza…')
    process.exitCode = 1
  }
}
