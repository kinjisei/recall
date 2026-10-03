/**
 * «Это связь?» и загрузка нескольких источников с пределом (PLAN.md Ф1.13):
 * src/shared/api/connection.ts и src/shared/lib/settleAll.ts.
 *
 * Ловим то, ради чего они есть: без сети экраны выдавали сбой за «пусто» или
 * висели на заглушках. Здесь — что считается сбоем связи (и что НЕ считается:
 * отказ прав, истёкший вход, наш русский текст), что ленивый кусок не
 * скачался (и что голое «Failed to fetch» — это сеть, а не кусок), и что
 * settleAll не падает сам, считает сбоем и упавшее, и не ответившее вовремя,
 * и бросившее сразу.
 *
 * Запуск: node scripts/test-connection.mjs
 */
import { CHUNK_OFFLINE_TEXT, isChunkLoadError, isConnectionError } from '../src/shared/api/connection.ts'
import { LoadTimeoutError, settleAll, withTimeout } from '../src/shared/lib/settleAll.ts'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}
const named = (name, message = '') => Object.assign(new Error(message), { name })

// --- что считается связью ---------------------------------------------------------
check('Chrome: TypeError Failed to fetch — связь', isConnectionError(new TypeError('Failed to fetch')))
check('Firefox: NetworkError — связь', isConnectionError(new TypeError('NetworkError when attempting to fetch resource.')))
check('Safari: Load failed — связь', isConnectionError(new TypeError('Load failed')))
check('ошибка supabase-js объектом, не Error — связь', isConnectionError({ message: 'TypeError: Failed to fetch', code: '' }))
check('вход не обновился без сети (AuthRetryableFetchError) — связь', isConnectionError(named('AuthRetryableFetchError', 'fetch failed')))
check('не ответил вовремя (LoadTimeoutError) — связь', isConnectionError(new LoadTimeoutError()))
check('ленивый кусок не скачался — связь', isConnectionError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')))

check('отказ прав RLS — НЕ связь', !isConnectionError({ message: 'new row violates row-level security policy', code: '42501' }))
check('истёкший вход (JWT expired) — НЕ связь', !isConnectionError({ message: 'JWT expired', code: 'PGRST301' }))
check('наш русский текст из RPC — НЕ связь', !isConnectionError(new Error('Работа не найдена или уже сдана.')))
check('пусто (null, undefined, строка) — НЕ связь', !isConnectionError(null) && !isConnectionError(undefined) && !isConnectionError('oops'))

// --- ленивый кусок ------------------------------------------------------------------
check('Chrome: не скачан кусок', isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/Grammar-1.js')))
check('Firefox: не скачан кусок', isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/a.js')))
check('Safari: не скачан кусок', isChunkLoadError(new TypeError('Importing a module script failed.')))
check('голое «Failed to fetch» — сеть, а не кусок', !isChunkLoadError(new TypeError('Failed to fetch')))
check('текст для человека про нескачанный раздел — по-русски и про интернет', /интернет/.test(CHUNK_OFFLINE_TEXT))

// --- withTimeout ----------------------------------------------------------------------
{
  const fast = await withTimeout(Promise.resolve(7), 50)
  check('withTimeout: успел — значение', fast === 7)
  const late = await withTimeout(new Promise(() => {}), 30).then(() => 'resolved', (e) => e)
  check('withTimeout: не успел — LoadTimeoutError, и это связь', late instanceof LoadTimeoutError && isConnectionError(late))
  const own = await withTimeout(Promise.reject(new Error('своя')), 50).then(() => null, (e) => e.message)
  check('withTimeout: своя ошибка проходит как есть', own === 'своя')
}

// --- settleAll --------------------------------------------------------------------------
{
  const r = await settleAll(
    {
      a: () => Promise.resolve(1),
      b: () => Promise.reject(new TypeError('Failed to fetch')),
      c: () => new Promise(() => {}), // зависла — как запрос на плохой связи
      d: () => {
        throw new Error('бросила сразу')
      },
      e: () => Promise.resolve(null), // «пусто» — это не сбой
    },
    40,
  )
  check('settleAll: пришедшее — в values', r.values.a === 1 && r.values.e === null)
  check('settleAll: упавшее, зависшее и бросившее сразу — в failed', ['b', 'c', 'd'].every((k) => r.failed.includes(k)), r.failed.join(','))
  check('settleAll: «пусто» — не сбой', !r.failed.includes('e') && !r.failed.includes('a'))
  check('settleAll: не пришедшее — null', r.values.b === null && r.values.c === null && r.values.d === null)
  const all = await settleAll({ x: () => Promise.resolve('x') }, 40)
  check('settleAll: всё пришло — failed пуст', all.failed.length === 0 && all.values.x === 'x')
}

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
