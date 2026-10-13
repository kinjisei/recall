/**
 * Код приложения в проверке качества AI (PLAN.md Ф2.20) — НАСТОЯЩИЙ: те же
 * `generateMaterialPlan`, `gradeWriting`, `generateStudyPlan`, что зовут
 * кнопки учителя, с их промптами, разбором ответа и фильтрами. Подменены
 * только три края, которых в Node нет или которые проверке мешают:
 *   • `shared/api/supabase.ts` — клиент базы браузера (читает import.meta.env);
 *   • `shared/api/ai.ts` — `chat` идёт не fetch-ем из браузера, а прямо в
 *     обработчик сервера `api/gemini.ts` (harness.mjs);
 *   • `lib/diagnostics.ts` — ученики из examples/students.mjs вместо базы.
 *
 * Плюс то, что умеет Vite и не умеет Node: импорт без расширения
 * (`'./text'`), `.js` вместо `.ts` (api/) и JSON без `with { type: 'json' }`.
 *
 * ⚠️ Подключать первой строкой, а код приложения брать ДИНАМИЧЕСКИ — как
 * `scripts/_api-loader.mjs` (почему — там же).
 */
import { registerHooks } from 'node:module'

const STUBS = {
  '/src/shared/api/supabase.ts': './stubs/supabase.mjs',
  '/src/shared/api/ai.ts': './stubs/ai.mjs',
  '/src/lib/diagnostics.ts': './stubs/diagnostics.mjs',
}

/** Что попробовать, если Node не нашёл файл так, как его записал Vite. */
const variants = (s) => (s.endsWith('.js') ? [s.slice(0, -3) + '.ts'] : [s + '.ts', s + '.tsx', s + '/index.ts'])

registerHooks({
  resolve(specifier, context, nextResolve) {
    let found
    try {
      found = nextResolve(specifier, context)
    } catch (e) {
      if (!specifier.startsWith('.')) throw e
      for (const v of variants(specifier)) {
        try {
          found = nextResolve(v, context)
          break
        } catch {
          /* следующий вариант */
        }
      }
      if (!found) throw e
    }
    for (const [real, stub] of Object.entries(STUBS)) {
      if (found.url.endsWith(real)) return { url: new URL(stub, import.meta.url).href, shortCircuit: true }
    }
    return found
  },
  load(url, context, nextLoad) {
    // JSON контента (уроки грамматики) — модулем: Vite импортирует его без атрибута
    if (url.endsWith('.json')) {
      const { source } = nextLoad(url, { ...context, format: 'json', importAttributes: { type: 'json' } })
      return { format: 'module', source: `export default ${String(source)}`, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
