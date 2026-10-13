/**
 * Общая часть проверок качества AI `scripts/check-ai-*.mjs` (PLAN.md Ф2.20,
 * журнал п.70, 74): ключ, учитель на тестовой базе, мост к серверу, лимит
 * запросов, ответы на диск, пакет для судьи и итог.
 *
 * Путь запроса — как у кнопки учителя: функция приложения (loader.mjs) →
 * `chat` → обработчик `api/gemini.ts` (вход, роль, журнал вызовов на
 * ТЕСТОВОЙ базе) → цепочка моделей Gemini. Ключ — только
 * `TEST_GEMINI_API_KEY` (отдельный проект, квоты живых учеников не тронуты);
 * Groq выключен — его ключ только боевой. Учитель проверки — админ тестовой
 * базы: лимиты генераций и энергии ему не мешают, проверяем качество.
 *
 * Флаги: `--limit=N` (запросов к AI, по умолчанию 20) · `--only=id,id` ·
 * `--dry` (собрать промпты без AI — бесплатно) · `--fake` (весь путь —
 * сервер, тестовая база, правила, файлы — а модель «отвечает» заготовкой из
 * fake-answers.mjs: проверка проверки без квоты) · `--spoil` (испорченный
 * промпт: проверка обязана покраснеть) · `--model=имя` (только эта модель
 * вместо цепочки — посмотреть запасную) · `--report=папка` (итог с вердиктами
 * судьи). Ответы — `scripts/ai-quality/runs/` (не в git).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { dbTarget, readEnv, runSql, scriptEnv } from '../_env.mjs'
import { deleteTestUser } from '../_users.mjs'
import { STUDENTS } from './examples/students.mjs'

const HERE = new URL('./', import.meta.url)
export const DEFAULT_LIMIT = 20
const EMAIL = 'ai-quality@recall.test'
const PASSWORD = 'AiQuality!2026'

export function parseArgs(argv = process.argv.slice(2)) {
  const val = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
  return {
    dry: argv.includes('--dry'),
    fake: argv.includes('--fake'),
    spoil: argv.includes('--spoil'),
    limit: Number(val('limit') ?? DEFAULT_LIMIT),
    only: val('only')?.split(',').filter(Boolean) ?? null,
    model: val('model') ?? null,
    report: val('report') ?? null,
  }
}

/** Критерии из criteria.md: номер → текст, кто проверяет, вес (Ж/М). Один источник для скрипта и судьи. */
export function criteriaTable() {
  const map = new Map()
  for (const line of readFileSync(new URL('criteria.md', HERE), 'utf8').split('\n')) {
    const m = line.match(/^\|\s*([А-ЯЁ][а-яё]?\d+)\s*\|(.*)\|([^|]*)\|\s*(Ж|М)\s*\|\s*$/)
    if (m) map.set(m[1], { text: m[2].trim(), who: m[3].trim(), weight: m[4] })
  }
  return map
}

/** JSON из ответа модели — так же терпимо, как приложение (от первой «{» до последней «}»). */
export function rawJson(text) {
  const s = String(text ?? '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  try {
    return a >= 0 && b > a ? JSON.parse(s.slice(a, b + 1)) : null
  } catch {
    return null
  }
}

/** Остановка не по вине AI: сухой прогон, лимит, нет ответа (квота, сбой). */
class Stop extends Error {
  constructor(kind, msg = kind) {
    super(msg)
    this.kind = kind
  }
}

const stamp = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function makeRes() {
  const r = { code: 200, payload: undefined }
  r.status = (c) => ((r.code = c), r)
  r.json = (p) => ((r.payload = p), r)
  r.setHeader = () => r
  r.write = () => true
  r.end = () => r
  r.destroy = () => r
  return r
}

/**
 * Прогон одной задачи. `opts.spoil` — строка, которую `--spoil` дописывает
 * в инструкцию модели («намеренно испорченный промпт»); `opts.spoilOnly` —
 * примеры для такого прогона, если `--only` не задан.
 */
export async function openRun(task, opts = {}) {
  const args = parseArgs()
  if (process.argv.includes('--prod')) {
    console.error('Проверка качества AI — только тестовая база и ключ TEST_GEMINI_API_KEY (журнал п.70).')
    process.exit(1)
  }
  if (args.report) return report(args.report)
  const only = args.only ?? (args.spoil ? opts.spoilOnly : null)
  const fileEnv = readEnv()
  if (!args.dry && !args.fake && !fileEnv.TEST_GEMINI_API_KEY) {
    console.error(
      'Нет TEST_GEMINI_API_KEY в .env.local. Прогоны — только на ключе отдельного проекта AI Studio,\n' +
        'чтобы не есть дневную квоту живых учеников (PLAN.md «Дела владельца»). Без AI: --dry.',
    )
    process.exit(1)
  }

  const run = { task, args, results: [], calls: 0, cur: null, uid: null, token: null, spoilHits: 0 }
  let gemini = null
  let lastModel = null
  let cleanup = async () => {}

  if (!args.dry) {
    const env = scriptEnv([])
    const sql = (q) => runSql(dbTarget([]), q)
    // серверу — ТЕСТОВАЯ база и тестовый ключ; боевые ключи из окружения не берём вовсе
    process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY
    process.env.GEMINI_API_KEY = args.fake ? 'fake-gemini' : fileEnv.TEST_GEMINI_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.RECALL_CHEAP_MODELS
    const { FAKE } = args.fake ? await import('./fake-answers.mjs') : { FAKE: {} }
    const realFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input?.url ?? input)
      const model = url.match(/models\/([^:/?]+):generateContent/)?.[1]
      if (args.fake && model) {
        // заготовка на этот запрос этого примера; нет заготовки — «квота кончилась»
        const text = FAKE[run.cur?.id]?.[run.cur.calls.length - 1]
        if (text === undefined) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 })
        lastModel = model
        const body = { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      const r = await realFetch(input, init)
      if (model && r.ok) lastModel = model
      return r
    }
    gemini = await import('../../api/gemini.ts')
    if (args.model) {
      const { GEMINI_TIER_CHAINS } = await import('../../api/_core.ts')
      for (const chain of Object.values(GEMINI_TIER_CHAINS)) chain.splice(0, chain.length, args.model)
    }

    const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'check-ai-* (временный)' })
    const made = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
    run.uid = made.data?.user?.id ?? (await sql(`select id from auth.users where email = '${EMAIL}'`))[0]?.id
    if (!run.uid) throw new Error(`не завёлся учитель проверки: ${made.error?.message}`)
    cleanup = async () => {
      await deleteTestUser(admin, sql, run.uid)
      await admin.from('allowed_emails').delete().eq('email', EMAIL)
    }
    try {
      await sql(`update public.profiles set role = 'teacher', is_admin = true where id = '${run.uid}'`)
      const [p] = await sql(`select role, is_admin from public.profiles where id = '${run.uid}'`)
      if (p?.role !== 'teacher' || !p?.is_admin) throw new Error('учитель проверки не стал преподавателем и админом тестовой базы')
      const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
      if (error) throw new Error(`вход учителя проверки: ${error.message}`)
      run.token = data.session.access_token
    } catch (e) {
      await cleanup().catch(() => {})
      throw e
    }
  }

  globalThis.__aiQuality = {
    diagnostics: (id) => STUDENTS[id],
    async chat(messages, o) {
      const call = { task: o.task, system: o.system ?? '', user: messages.map((m) => m.content).join('\n\n') }
      run.cur.calls.push(call)
      if (args.dry) throw new Stop('dry', 'сухой прогон')
      if (run.calls >= args.limit) throw new Stop('limit', `лимит ${args.limit} запросов`)
      run.calls++
      if (args.spoil && opts.spoil) {
        call.system = `${call.system}\n\n${opts.spoil}`
        run.spoilHits++
      }
      lastModel = null
      const res = makeRes()
      const t0 = Date.now()
      await gemini.handle(
        { method: 'POST', headers: { authorization: `Bearer ${run.token}` }, body: { messages, system: call.system, task: o.task } },
        res,
      )
      Object.assign(call, { ms: Date.now() - t0, model: lastModel, status: res.code })
      if (res.code !== 200) {
        call.error = res.payload?.error ?? `код ${res.code}`
        throw new Stop('no-answer', call.error)
      }
      call.text = res.payload.text
      return call.text
    },
  }

  return {
    args,
    /**
     * Отобрать примеры по --only сразу из всех списков задачи (у письма их
     * два). Неизвестный номер — ошибка, а не тихий пропуск.
     */
    pick(...lists) {
      const ids = lists.flat().map((e) => e.id)
      const unknown = (only ?? []).filter((id) => !ids.includes(id))
      if (unknown.length) throw new Error(`нет таких примеров: ${unknown.join(', ')}`)
      return lists.map((l) => l.filter((e) => !only || only.includes(e.id)))
    },
    /**
     * Прогнать пример: `fn(lastCall)` зовёт функции приложения и возвращает
     * выход, `rules(out)` — строки 🤖, `judge` — номера критериев 👁 судье.
     */
    async example(ex, fn, rules, judge) {
      run.cur = { id: ex.id, title: ex.title, note: ex.judge ?? '', calls: [], judge, status: 'ok', rows: [], output: null }
      let out
      try {
        out = await fn(() => run.cur.calls.at(-1))
      } catch (e) {
        if (!(e instanceof Stop)) {
          // приложение не разобрало ответ модели — это и есть промах качества (О1)
          run.cur.rows = [{ id: 'О1', ok: false, detail: e.message }]
        } else {
          run.cur.status = e.kind
          run.cur.error = e.message
        }
      }
      if (out !== undefined) {
        run.cur.output = out
        run.cur.rows = [{ id: 'О1', ok: true, detail: '' }, ...rules(out)] // ошибка в правилах — громко, не «промах AI»
      }
      run.results.push(run.cur)
      printExample(run.cur)
    },
    async finish(input) {
      try {
        if (args.spoil && run.calls > 0 && run.spoilHits === 0) throw new Error('испорченный промпт ни разу не ушёл модели')
        if (args.dry) return printDry(run)
        const tags = [args.fake && 'fake', args.spoil && 'spoil', args.model].filter(Boolean).map((t) => `-${t}`).join('')
        const dir = new URL(`runs/${task}-${stamp()}${tags}/`, HERE)
        mkdirSync(dir, { recursive: true })
        writeFileSync(new URL('answers.json', dir), JSON.stringify({ task, args, input, results: run.results }, null, 2))
        writeFileSync(new URL('judge.md', dir), judgePack(task, run.results, input))
        const path = decodeURIComponent(dir.pathname).replace(/^\/([A-Za-z]:)/, '$1')
        console.log(`\nЗапросов к AI: ${run.calls} из ${args.limit}. Ответы и пакет судьи: ${path}`)
        console.log(`Дальше: судья по judge.md → verdicts.json, потом: node scripts/check-ai-${task}.mjs --report=${path}`)
        const red = run.results.flatMap((r) => r.rows.filter((x) => !x.ok).map((x) => `${r.id} ${x.id}`))
        console.log(red.length ? `🤖 красное: ${red.length} — ${red.join(', ')}` : '🤖 скрипт: всё зелёное (до судьи)')
        process.exitCode = red.length ? 1 : 0
      } finally {
        await cleanup().catch((e) => console.error('уборка учителя проверки:', e.message))
      }
    },
  }
}

function printExample(r) {
  const models = [...new Set(r.calls.map((c) => c.model).filter(Boolean))].join(', ')
  const secs = r.calls.reduce((a, c) => a + (c.ms ?? 0), 0) / 1000
  if (r.status !== 'ok') return console.log(`… ${r.id} — ${r.status === 'dry' ? `промптов: ${r.calls.length}` : r.error}`)
  const bad = r.rows.filter((x) => !x.ok)
  console.log(`${bad.length ? '✗' : '✓'} ${r.id} (${models || '—'}, ${secs.toFixed(0)} с)${bad.map((x) => `\n    ${x.id}: ${x.detail}`).join('')}`)
}

function printDry(run) {
  for (const r of run.results) {
    console.log(`\n══ ${r.id} — ${r.title}`)
    for (const c of r.calls) console.log(`── задача ${c.task}, инструкция ${c.system.length} зн.\n${c.user}`)
  }
  console.log(`\nСухой прогон: ${run.results.length} примеров, ${run.results.reduce((a, r) => a + r.calls.length, 0)} промптов, к AI — 0 запросов.`)
}

/** Пакет судьи: правила, критерии из criteria.md, по каждому примеру — вход, проверка скрипта и ответ AI. */
function judgePack(task, results, input) {
  const table = criteriaTable()
  const used = [...new Set(results.flatMap((r) => r.judge ?? []))]
  const lines = [
    `# Судья качества AI: ${task}`,
    '',
    'Ты — судья качества AI в приложении Recall (PLAN.md Ф2.20). Оцени ответы AI ниже ТОЛЬКО по',
    'критериям, перечисленным у каждого примера. Вердикт: `pass`, `fail` или `unsure`.',
    '- `fail` и `unsure` — с точной цитатой из ответа AI (`quote`) и пояснением по-русски (`note`).',
    '  Без цитаты `fail` не принимается.',
    '- Сомневаешься в правиле языка — `unsure`, не `fail`: спорное решает Claude.',
    '- Испанский — норма Испании (журнал п.74). Ученик — русскоговорящий.',
    '- Ответ — файл `verdicts.json` рядом с этим: JSON-массив',
    '  `{"id": "<пример>", "criterion": "<номер>", "verdict": "pass|fail|unsure", "quote": "…", "note": "…"}` —',
    '  по одной строке на каждый критерий каждого примера.',
    '',
    '## Критерии',
    '',
    '| № | Критерий |',
    '|---|---|',
    ...used.map((id) => `| ${id} | ${table.get(id)?.text ?? '(нет в criteria.md)'} |`),
  ]
  for (const r of results.filter((x) => x.status === 'ok')) {
    const ex = input.find((e) => e.id === r.id)
    lines.push('', `## ${r.id} — ${r.title}`, '', `**Критерии:** ${(r.judge ?? []).join(', ')}`, '', `**На что смотреть:** ${r.note}`, '')
    lines.push('**Вход:**', '', '```json', JSON.stringify(ex, null, 2), '```', '')
    lines.push('**Проверка скрипта:** ' + r.rows.map((x) => `${x.ok ? '✓' : '✗'} ${x.id}${x.ok ? '' : ` (${x.detail})`}`).join(' · '), '')
    lines.push('**Ответ AI (как его увидит учитель):**', '', '```json', JSON.stringify(r.output, null, 2), '```')
  }
  return lines.join('\n') + '\n'
}

/**
 * Итог прогона: строки скрипта + вердикты судьи (+ решения Claude по спорному:
 * строка с `"by": "claude"` заменяет вердикт по тому же примеру и критерию).
 * Ж — без единого промаха и «не уверен»; М — не меньше 80 % примеров.
 */
function report(dirArg) {
  const dir = dirArg.replace(/[\\/]?$/, '/')
  const answers = JSON.parse(readFileSync(dir + 'answers.json', 'utf8'))
  const verdicts = existsSync(dir + 'verdicts.json') ? JSON.parse(readFileSync(dir + 'verdicts.json', 'utf8')) : []
  const table = criteriaTable()
  // «пример|критерий» → что сказали скрипт, судья и Claude. Критерий, который
  // проверяют двое (М8, М10…), зелёный, только если зелёные оба: строка
  // скрипта не заменяет вердикт судьи.
  const cells = new Map()
  const cell = (key) => cells.get(key) ?? cells.set(key, { script: null, judge: null, claude: null, needJudge: false }).get(key)
  for (const r of answers.results.filter((x) => x.status === 'ok')) {
    for (const x of r.rows) cell(`${r.id}|${x.id}`).script = { v: x.ok ? 'pass' : 'fail', why: x.detail }
    for (const c of r.judge ?? []) cell(`${r.id}|${c}`).needJudge = true
  }
  for (const v of verdicts) {
    const c = cells.get(`${v.id}|${v.criterion}`)
    if (c) c[v.by === 'claude' ? 'claude' : 'judge'] = { v: v.verdict, why: `${v.quote ?? ''} ${v.note ?? ''}`.trim() }
  }
  /** Итог клетки: Claude решает спорное; иначе красное любого — красное; судьи нет, а нужен — «нет вердикта». */
  const final = (c) => {
    if (c.claude) return c.claude
    const red = [c.script, c.judge].find((x) => x?.v === 'fail')
    if (red) return red
    if (c.needJudge && !c.judge) return { v: 'нет вердикта', why: c.script?.why ?? '' }
    return [c.judge, c.script].find((x) => x?.v === 'unsure') ?? { v: 'pass', why: '' }
  }
  const by = new Map()
  for (const [key, c] of cells) {
    const [id, crit] = key.split('|')
    if (!by.has(crit)) by.set(crit, [])
    by.get(crit).push({ id, ...final(c) })
  }
  let green = true
  const order = [...table.keys()]
  for (const c of [...by.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
    const rows = by.get(c)
    const pass = rows.filter((x) => x.v === 'pass').length
    const weight = table.get(c)?.weight ?? 'Ж'
    const ok = weight === 'Ж' ? pass === rows.length : pass >= Math.ceil(rows.length * 0.8)
    green &&= ok
    console.log(`${ok ? '✓' : '✗'} ${c} (${weight}) ${pass}/${rows.length} — ${table.get(c)?.text.slice(0, 70) ?? ''}`)
    for (const x of rows.filter((r) => r.v !== 'pass')) console.log(`    ${x.v}: ${x.id} — ${x.why ?? ''}`)
  }
  const skipped = answers.results.filter((x) => x.status !== 'ok')
  for (const s of skipped) console.log(`… не прогнан: ${s.id} — ${s.error}`)
  const verdict = skipped.length ? 'НЕПОЛНЫЙ' : green ? 'ЗЕЛЁНЫЙ' : 'КРАСНЫЙ'
  console.log(`\nИтог ${answers.task}: ${verdict}${answers.args.spoil ? ' (испорченный промпт — должен быть КРАСНЫЙ)' : ''}`)
  process.exit(verdict === 'ЗЕЛЁНЫЙ' ? 0 : 1)
}
