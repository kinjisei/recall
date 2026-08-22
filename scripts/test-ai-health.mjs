/**
 * Чистый тест защиты «3 серверных сбоя AI за час → перегрузка» (lib/aiHealth).
 *
 * Без браузера: подменяем localStorage и Date. Умеет краснеть — сдвинь порог
 * или окно, и проверки упадут.
 *
 * Запуск: node scripts/test-ai-health.mjs
 */
let store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v)
  },
  removeItem: (k) => {
    delete store[k]
  },
}

const { recordAiServerFailure, clearAiFailures, aiOverloaded } = await import('../src/lib/aiHealth.ts')

const results = []
const check = (name, ok) => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}`)
}

clearAiFailures()
check('чисто → не перегружен', aiOverloaded() === false)

recordAiServerFailure()
recordAiServerFailure()
check('2 сбоя за час → ещё НЕ перегружен', aiOverloaded() === false)

recordAiServerFailure()
check('3 сбоя за час → перегружен', aiOverloaded() === true)

clearAiFailures()
check('успех (clear) обнуляет серию', aiOverloaded() === false)

// Старые сбои (все старше часа) выпадают из окна и не считаются.
const H = 60 * 60 * 1000
store['recall.aiFails'] = JSON.stringify([Date.now() - 2 * H, Date.now() - 1.5 * H, Date.now() - 1.1 * H])
check('три сбоя, но все старше часа → НЕ перегружен', aiOverloaded() === false)

// Свежие считаются даже рядом со старыми.
store['recall.aiFails'] = JSON.stringify([
  Date.now() - 2 * H, // старый — не в счёт
  Date.now() - 10 * 60 * 1000,
  Date.now() - 5 * 60 * 1000,
  Date.now() - 1 * 60 * 1000,
])
check('три свежих сбоя (плюс один старый) → перегружен', aiOverloaded() === true)

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
