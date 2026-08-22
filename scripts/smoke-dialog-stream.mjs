/**
 * Смоук: «Диалог» отдаёт ответ ПОТОКОМ, а не одним куском.
 *
 * Зачем отдельно. smoke-chat-history проверяет, что переписка цела; здесь —
 * что ответ действительно СТРИМИТСЯ: приходит как text/plain по кускам, а не
 * ждётся целиком и не откачен обратно на JSON `{text}`.
 *
 * Умеет краснеть: откати стриминг на прежний `{text}` — Content-Type станет
 * application/json, и проверка «ответ — поток» упадёт. Просит длинный ответ
 * (счёт до 15), чтобы кусков было заведомо несколько.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-dialog-stream.mjs`.
 * Прод: AUDIT_BASE_URL=https://recall-pgkz.vercel.app (там нужен вход — смоук
 * рассчитан на локальный dev, где /api/gemini без токена).
 */
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

try {
  const res = await fetch(`${BASE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Count from 1 to 15, one number per line, digits only.' },
      ],
      task: 'dialog',
      stream: true,
    }),
  })

  check('ответ 200', res.ok, `HTTP ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  // Главная красноспособная проверка: поток — это text/plain. Откат на {text}
  // вернул бы application/json, и здесь бы упало.
  check('ответ — поток (text/plain), не JSON', ct.includes('text/plain'), ct || 'нет content-type')

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  const stamps = []
  let full = ''
  const t0 = Date.now()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const s = dec.decode(value, { stream: true })
    if (s) {
      full += s
      stamps.push(Date.now() - t0)
    }
  }

  check('текст пришёл', full.trim().length > 0, `${full.length} символов`)
  check('пришёл несколькими кусками (стриминг)', stamps.length >= 2, `кусков: ${stamps.length}`)
  check(
    'первый кусок раньше последнего',
    stamps.length >= 2 && stamps[0] < stamps[stamps.length - 1],
    stamps.length >= 2 ? `${stamps[0]}мс → ${stamps[stamps.length - 1]}мс` : '',
  )
  // Если стрим тайком вернули на JSON-блоб — тело будет {"text":"…"}.
  const looksJson = full.trim().startsWith('{') && full.includes('"text"')
  check('это не JSON-блоб (стрим не откатили на {text})', !looksJson)
} catch (e) {
  check('прогон завершился', false, e.message)
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
