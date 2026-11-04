/**
 * Каждый вызов AI в приложении — с решениями (Ф2.20): испанский, JSON, «ты»:
 *   • испанский — Испании (журнал п.74, src/lib/promptRules.ts): правило
 *     варианта есть в каждом промпте, где AI пишет или правит испанский;
 *   • режим JSON (журнал п.77, api/_geminiBody.ts): там, где ответ
 *     разбирается как JSON, вызов просит `json: true` — модель не теряет
 *     скобок, и человек не получает «AI вернул не-JSON» за списанную энергию;
 *     письмо и материалы — схему ответа (`json: …Schema(…)`, Ф2.20-3): режим
 *     без схемы у слабой модели всё равно ломался.
 *
 * Держит:
 *   1. каждый файл с вызовом AI (`chat(` / `chatStream(` / `chatReply(`) — в
 *      списке ниже; новый файл без решения — красный;
 *   2. промпт берёт `variantRule` (или записана причина, почему не нужно);
 *   3. число вызовов с JSON в файле и из них со схемой — как записано; где AI пишет
 *      человеку по-русски — правило «ты» (журнал п.71);
 *   4. у промптов материала правило есть у испанского и нет у английского;
 *      разбор работ не прощает опечатку (журнал п.74);
 *   5. само правило: Испания и запрет латиноамериканских слов;
 *   6. тело запроса: `json` → responseMimeType, у Gemma — нет.
 *
 * Без сети и базы. Запуск: node scripts/test-ai-prompts.mjs
 */
// клиентский код (импорты без расширения) — через загрузчик проверок AI
import './ai-quality/loader.mjs'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/**
 * Файл с вызовом AI → где его промпт (берёт variantRule) или почему правило
 * не нужно; `json` — сколько вызовов в файле разбирают ответ как JSON,
 * `schema` — сколько из них шлют схему ответа;
 * `ty` — AI пишет человеку по-русски: промпт обращается на «ты»
 * (ADDRESS_RULE или своя строка про «ты», как в Диалоге).
 */
const CALLS = {
  // план, текст, «Мой текст» — по схеме (domains/materials/schema.ts), AI-разбор работы — режим JSON
  'src/lib/materials.ts': { prompt: 'src/lib/materialPrompts.ts', json: 4, schema: 3, ty: true },
  'src/domains/materials/api.ts': { prompt: 'src/lib/materialPrompts.ts', json: 1, schema: 1, ty: true },
  'src/lib/writingGrade.ts': { prompt: 'src/lib/writingGrade.ts', json: 2, schema: 2, ty: true },
  'src/lib/studyPlan.ts': { prompt: 'src/lib/studyPlan.ts', json: 1, ty: true },
  'src/lib/explain.ts': { prompt: 'src/lib/explain.ts', json: 0, ty: true },
  'src/features/conversation/ConversationPage.tsx': { prompt: 'src/features/conversation/ConversationPage.tsx', json: 0, ty: true },
  'src/features/quests/QuestsPage.tsx': { prompt: 'src/features/quests/QuestsPage.tsx', json: 0, ty: true },
  'src/features/writing/QuickWriteCheck.tsx': { prompt: 'src/features/writing/QuickWriteCheck.tsx', json: 0, ty: true },
  'src/lib/writing.ts': { skip: 'задания IELTS — только английский', json: 1 },
  'src/lib/definitions.ts': { skip: 'англо-английские определения', json: 1 },
  'src/lib/analyze.ts': { skip: 'перевод и разбор выделенного фрагмента — ответ по-русски, испанского AI не пишет', json: 1 },
  'src/lib/textAnalysis.ts': { skip: 'разбор готового текста — ответ по-русски', json: 2, ty: true },
  'src/lib/contextDict.ts': { skip: 'перевод слова на русский', json: 0 },
  'src/lib/phrase.ts': { skip: 'перевод фразы на русский', json: 0 },
  'src/lib/homeworkSuggest.ts': { skip: 'формулировки пунктов домашки по-русски', json: 1, ty: true },
}

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${typeof got === 'string' ? got : JSON.stringify(got)}`}`)
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}
const rel = (p) => relative(ROOT, p).split(sep).join('/')
const src = (p) => readFileSync(join(ROOT, p), 'utf8')

// 1–3. каждый вызов AI — с решениями
const callers = walk(join(ROOT, 'src'))
  .map(rel)
  .filter((p) => !p.startsWith('src/shared/api/') && /\b(chat|chatStream|chatReply)\(/.test(src(p)))
const unknown = callers.filter((p) => !CALLS[p])
check('каждый файл с вызовом AI — в списке (новый: реши про испанский и JSON)', unknown.length === 0, unknown.join(', '))
const gone = Object.keys(CALLS).filter((p) => !callers.includes(p))
check('в списке нет файлов, которые AI уже не зовут', gone.length === 0, gone.join(', '))
for (const [file, d] of Object.entries(CALLS)) {
  if (!d.skip) check(`${file}: промпт берёт variantRule`, /variantRule\(/.test(src(d.prompt)), d.prompt)
  if (d.ty) check(`${file}: AI обращается на «ты»`, /ADDRESS_RULE|«ты»/.test(src(d.prompt ?? file)), d.prompt ?? file)
  // `json: true` — режим JSON, `json: ieltsSchema(…)` — схема ответа
  const n = (src(file).match(/\bjson: (true\b|\w+Schema\()/g) ?? []).length
  check(`${file}: вызовов с json — ${d.json}`, n === d.json, `найдено ${n}`)
  const sch = (src(file).match(/\bjson: \w+Schema\(/g) ?? []).length
  check(`${file}: из них со схемой ответа — ${d.schema ?? 0}`, sch === (d.schema ?? 0), `найдено ${sch}`)
}

// 4. промпты материала: у испанского правило есть, у английского — нет
const { SPANISH_VARIANT_RULE, variantRule } = await import('../src/lib/promptRules.ts')
const M = await import('../src/lib/materialPrompts.ts')
const req = (lang) => ({ lang, level: 'B1', topic: 'viaje', format: 'text', lengthRange: '150-200', vocabulary: '', grammar: '' })
check('план: ES — с правилом, EN — без', M.planSystem(req('es')).includes(SPANISH_VARIANT_RULE) && !M.planSystem(req('en')).includes(SPANISH_VARIANT_RULE))
check('правила упражнений: ES — с правилом, EN — без', M.exerciseSpec('es', 'B1').rules.includes(SPANISH_VARIANT_RULE) && !M.exerciseSpec('en', 'B1').rules.includes(SPANISH_VARIANT_RULE))
check('разбор работы: ES — с правилом, EN — без', M.reviewSystem('es').includes(SPANISH_VARIANT_RULE) && !M.reviewSystem('en').includes(SPANISH_VARIANT_RULE))
check('разбор работы: опечатка «wich» — пример ok=false (журнал п.74)', /ok=false: «playd» вместо «played», «wich»/.test(M.reviewSystem('en')), M.reviewSystem('en'))

// 5. само правило
check('variantRule: у испанского — правило, у английского — пусто', variantRule('es') === SPANISH_VARIANT_RULE && variantRule('en') === '')
check('правило: Испания и запрет латиноамериканского', ['ИСПАНИИ', 'vosotros', 'coche', 'móvil', 'carro', 'celular'].every((w) => SPANISH_VARIANT_RULE.includes(w)))

// 6. тело запроса и что сервер принимает от клиента
const { geminiBody } = await import('../api/_geminiBody.ts')
const contents = [{ role: 'user', parts: [{ text: 'hi' }] }]
const cfg = (model, json) => JSON.parse(geminiBody(model, 'sys', contents, 'standard', json)).generationConfig
check('json → responseMimeType application/json', cfg('gemini-3.6-flash', true).responseMimeType === 'application/json', cfg('gemini-3.6-flash', true))
check('без json — обычный текст', cfg('gemini-3.6-flash', false).responseMimeType === undefined, cfg('gemini-3.6-flash', false))
check('у Gemma режима JSON нет — не ставим', cfg('gemma-4-31b-it', true).responseMimeType === undefined, cfg('gemma-4-31b-it', true))
const schema = { type: 'object', properties: { a: { type: 'string' } } }
check('схема → responseJsonSchema', JSON.stringify(cfg('gemini-3.6-flash', schema).responseJsonSchema) === JSON.stringify(schema), cfg('gemini-3.6-flash', schema))
const { jsonMode } = await import('../api/_jsonMode.ts')
check('сервер: true → режим JSON, схема → схема', jsonMode(true) === true && jsonMode(schema) === schema)
check('api/gemini.ts берёт json от клиента через jsonMode', /const wantsJson = jsonMode\(json\)/.test(src('api/gemini.ts')))
check('сервер: мусор → без JSON, огромная схема → просто режим JSON', jsonMode('x') === false && jsonMode([1]) === false && jsonMode({ big: 'x'.repeat(9000) }) === true)

console.log(`\n${pass}/${pass + fail}`)
if (fail) process.exit(1)
