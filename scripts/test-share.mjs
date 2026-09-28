/**
 * «Поделиться» src/shared/lib/share.ts (PLAN.md Ф1.5; журнал п.23).
 *
 *   • номер для wa.me — только цифры в международном виде: «+7 701…»,
 *     «8 (701)…», «701…» дают одно и то же; чужие коды — как есть; мусор —
 *     без номера (WhatsApp спросит контакт);
 *   • текст доходит до мессенджера ровно таким, каким его написали:
 *     кириллица, перенос строки, &, ?, #, +, эмодзи — после раскодирования
 *     совпадают, «&» в тексте не рвёт параметры, пробел не становится «+»;
 *   • системное «Поделиться»: нет — «unsupported», закрыл окно —
 *     «cancelled», отправил — «shared».
 * Чистый: без сети и браузера.
 * Запуск: node scripts/test-share.mjs
 */
import { shareNative, telegramLink, waPhone, whatsappLink } from '../src/shared/lib/share.ts'

let fail = 0
let total = 0
const check = (name, got, want) => {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ждали ${JSON.stringify(want)}, получили ${JSON.stringify(got)}`}`)
}

// ── номер ────────────────────────────────────────────────────────────────────
check('«+7 701 123 45 67»', waPhone('+7 701 123 45 67'), '77011234567')
check('«8 (701) 123-45-67» — восьмёрка становится 7', waPhone('8 (701) 123-45-67'), '77011234567')
check('«701 123 45 67» — десять цифр, код +7', waPhone('701 123 45 67'), '77011234567')
check('Узбекистан «+998 90 123 45 67» — как есть', waPhone('+998 90 123 45 67'), '998901234567')
check('США «+1 (415) 555-2671» — как есть', waPhone('+1 (415) 555-2671'), '14155552671')
check('короткий мусор — без номера', waPhone('123'), null)
check('пусто — без номера', waPhone(''), null)

// ── WhatsApp ─────────────────────────────────────────────────────────────────
const TEXT = 'Айгерим, привет!\nОстался 1 оплаченный урок & вопрос? #оплата +8 уроков 🙂'
const wa = whatsappLink(TEXT, '8 701 123 45 67')
const waUrl = new URL(wa)
check('WhatsApp: номер в пути', waUrl.pathname, '/77011234567')
check('WhatsApp: текст раскодируется в точности', waUrl.searchParams.get('text'), TEXT)
check('WhatsApp: в ссылке нет сырых пробелов и переносов', /[\s]/.test(wa), false)
// сырой текст ссылки: пробел — «%20», свой «+» — «%2B»; голого «+» нет вовсе
// (URLSearchParams дал бы «+» вместо пробела — у части клиентов так и видно)
const rawText = wa.split('?text=')[1] ?? ''
check('WhatsApp: пробел — %20, «+» закодирован, голого «+» нет', rawText.includes('%20') && rawText.includes('%2B') && !rawText.includes('+'), true)
check('WhatsApp без номера — выбор контакта', whatsappLink('Привет').startsWith('https://wa.me/?text='), true)
check('WhatsApp с непонятным номером — выбор контакта', whatsappLink('Привет', 'abc').startsWith('https://wa.me/?text='), true)

// ── Telegram ─────────────────────────────────────────────────────────────────
const tg = new URL(telegramLink(TEXT, 'https://recall-pgkz.vercel.app/?a=1&b=2'))
check('Telegram: адрес t.me/share/url', `${tg.host}${tg.pathname}`, 't.me/share/url')
check('Telegram: текст раскодируется в точности', tg.searchParams.get('text'), TEXT)
check('Telegram: ссылка с «&» не рвёт параметры', tg.searchParams.get('url'), 'https://recall-pgkz.vercel.app/?a=1&b=2')
check('Telegram: ровно два параметра', [...tg.searchParams.keys()], ['url', 'text'])

// ── системное «Поделиться» ───────────────────────────────────────────────────
const setNavigator = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true })
const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
setNavigator({})
check('нет navigator.share — unsupported', await shareNative('t'), 'unsupported')
let got = null
setNavigator({ share: async (data) => void (got = data) })
check('поделился — shared', await shareNative('текст', 'https://x.y'), 'shared')
check('в окно ушли текст и ссылка', got, { text: 'текст', url: 'https://x.y' })
setNavigator({ share: async () => { throw new DOMException('closed', 'AbortError') } })
check('закрыл окно — cancelled', await shareNative('t'), 'cancelled')
setNavigator({ share: async () => { throw new DOMException('no', 'NotAllowedError') } })
check('отказ браузера — unsupported (предложим ссылки)', await shareNative('t'), 'unsupported')
if (original) Object.defineProperty(globalThis, 'navigator', original)

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
