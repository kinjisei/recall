/**
 * Живая проверка: каждая модель, которую зовёт api/, есть у поставщика
 * (PLAN.md Ф1.6).
 *
 * 16.08.2026 Groq выключил llama-3.1-8b-instant и llama-3.3-70b-versatile, а
 * код звал их ещё полтора месяца: перевод слова тратил лишний запрос на
 * отказ, а у обычных задач не было последнего рубежа. Снаружи не видно
 * ничего — цепочка молча идёт к следующей модели. Здесь списки моделей
 * поставщиков (запрос списка квоту НЕ тратит) сверяются с тем, что в коде.
 *
 * --call — ещё по одному короткому запросу к каждой модели Groq (форма
 * запроса та же, что у api/_groq.ts). Gemini не зовём никогда: у flash-моделей
 * бесплатный запас ~20 запросов в сутки на весь проект.
 * --list — напечатать всё, что есть у поставщиков (подобрать замену).
 *
 * Поток (streamGenerateContent) Google в списке методов не называет — он
 * идёт вместе с generateContent, поэтому сверяем только его.
 *
 * Ключи — из .env.local (GEMINI_API_KEY, GROQ_API_KEY). Сеть и секреты,
 * поэтому check-, а не test-: в CI не входит.
 * Запуск: node scripts/check-ai-models.mjs [--call] [--list]
 */
import './_api-loader.mjs'
import { readEnv } from './_env.mjs'

const env = readEnv()
const LIST = process.argv.includes('--list')
const { GEMINI_TIER_CHAINS, DEFAULT_GEMINI_MODEL } = await import('../api/_core.ts')
const { GROQ_MODELS, groqChat } = await import('../api/_groq.ts')
const { STT_MODEL } = await import('../api/_stt.ts')

let failed = 0
const check = (name, ok, extra = '') => {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// --- Gemini ---------------------------------------------------------------------
console.log('\n— Gemini (generativelanguage.googleapis.com)')
if (!env.GEMINI_API_KEY) {
  check('GEMINI_API_KEY в .env.local', false)
} else {
  const listed = new Map()
  let page = ''
  do {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${page ? `&pageToken=${page}` : ''}`,
      { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } },
    )
    if (!res.ok) throw new Error(`список моделей Gemini: ${res.status}`)
    const body = await res.json()
    for (const m of body.models ?? []) {
      listed.set(m.name.replace(/^models\//, ''), m.supportedGenerationMethods ?? [])
    }
    page = body.nextPageToken ?? ''
  } while (page)

  if (LIST) {
    for (const [name, methods] of listed) {
      if (methods.includes('generateContent')) console.log(`  · ${name}`)
    }
  }
  const wanted = new Set([DEFAULT_GEMINI_MODEL, ...Object.values(GEMINI_TIER_CHAINS).flat()])
  for (const model of wanted) {
    const methods = listed.get(model)
    check(
      model,
      methods?.includes('generateContent'),
      !methods ? 'нет у поставщика' : methods.includes('generateContent') ? '' : 'не умеет generateContent',
    )
  }
}

// --- Groq -----------------------------------------------------------------------
console.log('\n— Groq (api.groq.com)')
if (!env.GROQ_API_KEY) {
  check('GROQ_API_KEY в .env.local', false)
} else {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
  })
  if (!res.ok) throw new Error(`список моделей Groq: ${res.status}`)
  const listed = new Map(((await res.json()).data ?? []).map((m) => [m.id, m]))
  if (LIST) for (const id of [...listed.keys()].sort()) console.log(`  · ${id}`)
  for (const model of [...Object.values(GROQ_MODELS), STT_MODEL]) {
    const m = listed.get(model)
    check(model, !!m && m.active !== false, !m ? 'нет у поставщика' : m.active === false ? 'выключена' : '')
  }

  if (process.argv.includes('--call')) {
    console.log('\n— Groq: по одному настоящему запросу')
    for (const model of Object.values(GROQ_MODELS)) {
      const t0 = Date.now()
      try {
        const text = await groqChat(
          [{ role: 'user', content: 'Translate to Russian, one word only: apple' }],
          'Answer with the translation only.',
          env.GROQ_API_KEY,
          model,
        )
        check(`${model} отвечает`, text.length > 0, `«${text.slice(0, 40)}», ${Date.now() - t0} мс`)
      } catch (e) {
        check(`${model} отвечает`, false, e.message)
      }
    }
  }
}

console.log(failed ? `\n✗ не в порядке: ${failed}` : '\n✓ все модели на месте')
process.exit(failed ? 1 : 0)
