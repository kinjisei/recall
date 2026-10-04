/**
 * Канал push и тексты уведомлений об уроках (PLAN.md Ф2.9; миграция 0011;
 * макет u3):
 *
 *   • тексты на примерах из макета u3: «Урок через час · 19:00 · …», «Урок
 *     перенесён · чт, 22 окт, 19:00 → пт, 23 окт, 18:00», «Уроки по четвергам
 *     теперь в 18:00 · с 29 окт · вместо 19:00», «Уроки по вторникам отменены ·
 *     с 27 окт · остальные уроки как были»; кривые данные не роняют текст;
 *   • PUSH_KINDS = push_kinds() миграции 0011;
 *   • pushView: «урок через час» после начала — не шлём; срок доставки до
 *     начала урока; одно уведомление на урок (tag);
 *   • шифрование настоящее: тест сам расшифровывает тело так, как это сделал
 *     бы телефон (RFC 8291), и проверяет подпись VAPID (RFC 8292);
 *   • ответы службы push: 410 → подписка удаляется; 429/5xx/сбой → повтор;
 *     400 → без повтора; ошибка наших ключей VAPID НЕ удаляет подписки;
 *   • сервер доставки отдаёт базе gone и retry.
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-push.mjs
 */
import './_api-loader.mjs'
import { createECDH, createHmac, createDecipheriv, createPublicKey, randomBytes, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

const { PUSH_KINDS, pushView, renderNotification } = await import('../src/domains/notifications/model.ts')
const { pushChannel, classify, endpointOk } = await import('../api/_push.ts')
const { handle } = await import('../api/notify.ts')
const webpush = (await import('web-push')).default

let fail = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}
const same = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), `ждали ${JSON.stringify(want)}, получили ${JSON.stringify(got)}`)

// ── тексты (время — по Алматы, UTC+5) ─────────────────────────────────────────────
const L = '11111111-2222-4333-8444-555555555555'
const S = '99999999-8888-4777-8666-555555555555'
const render = (kind, data, created_at) => renderNotification({ kind, data, created_at })
same('урок через час (u3-1)', render('lesson_soon', { lesson: L, at: '2026-10-15T14:00:00Z', teacher_name: 'Мадина Сейткали', link: true, href: `/lessons?lesson=${L}` }, '2026-10-15T13:00:20Z'), {
  title: 'Урок через час', body: '19:00 · Мадина Сейткали · ссылка на урок внутри', href: `/lessons?lesson=${L}`,
})
same('урок создан за 25 минут — «через 25 минут», группа — название, без ссылки',
  render('lesson_soon', { at: '2026-10-15T14:00:00Z', teacher_name: 'Мадина', title: 'Разговорный клуб', link: false }, '2026-10-15T13:35:00Z'),
  { title: 'Урок через 25 минут', body: '19:00 · Разговорный клуб', href: undefined })
same('урок через 1 минуту — «начинается»', render('lesson_soon', { at: '2026-10-15T14:00:00Z' }, '2026-10-15T13:59:00Z').title, 'Урок начинается')
same('урок перенесён (u3-1)', render('lesson_moved', { from: '2026-10-22T14:00:00Z', to: '2026-10-23T13:00:00Z', href: `/lessons?lesson=${L}` }), {
  title: 'Урок перенесён', body: 'чт, 22 окт, 19:00 → пт, 23 окт, 18:00', href: `/lessons?lesson=${L}`,
})
same('урок отменён (u3-1)', render('lesson_cancelled', { at: '2026-10-20T14:00:00Z' }).body, 'вт, 20 окт, 19:00')
same('урок снова в расписании', render('lesson_restored', { at: '2026-10-20T14:00:00Z', title: 'Клуб' }), {
  title: 'Урок снова в расписании', body: 'вт, 20 окт, 19:00 · Клуб', href: undefined,
})
same('новое время серии (u3-2)', render('lessons_rescheduled', {
  series: S, since: '2026-10-29', weekdays: [4], time: '18:00', minutes: 60, every_weeks: 1,
  old: { weekdays: [4], time: '19:00', minutes: 60, every_weeks: 1 }, href: '/lessons',
}), { title: 'Уроки по четвергам теперь в 18:00', body: 'с 29 окт · вместо 19:00', href: '/lessons', action: 'Мои уроки' })
same('убрали день из серии (u3-2)', render('lessons_rescheduled', {
  since: '2026-10-27', weekdays: [4], time: '19:00', minutes: 60, every_weeks: 1,
  old: { weekdays: [2, 4], time: '19:00', minutes: 60, every_weeks: 1 },
}), { title: 'Уроки по вторникам отменены', body: 'с 27 окт · остальные уроки как были', href: undefined, action: undefined })
same('прежнее неизвестно — новое расписание целиком', render('lessons_rescheduled', {
  since: '2026-10-29', weekdays: [5, 2], time: '18:00', minutes: 90, every_weeks: 2, until: '2026-12-20', old: null, title: 'Клуб',
}).body, 'с 29 окт — раз в две недели вт и пт, 18:00–19:30 · до 20 дек · Клуб')
same('отмена серии', render('lessons_cancelled', { since: '2026-10-27', weekdays: [2, 4], href: '/lessons' }), {
  title: 'Уроки по вторникам и четвергам отменены', body: 'с 27 окт', href: '/lessons', action: 'Мои уроки',
})
const junk = ['lesson_soon', 'lesson_moved', 'lesson_cancelled', 'lesson_restored', 'lessons_rescheduled', 'lessons_cancelled']
  .map((k) => render(k, { at: 'завтра', from: 42, weekdays: ['пн', 9], time: '7 вечера', since: 'скоро', old: 'x', href: 'https://evil.example' }))
check('кривые данные: заголовок есть, ни «undefined», ни «NaN», внешняя ссылка не проходит',
  junk.every((v) => v.title && !/undefined|NaN|Invalid/.test(JSON.stringify(v)) && v.href === undefined), JSON.stringify(junk))

// ── список видов для push = база ─────────────────────────────────────────────────────
const sql = readFileSync(new URL('../supabase/migrations/0011_lesson_notifications.sql', import.meta.url), 'utf8')
const sqlKinds = [...(/function public\.push_kinds\(\)[\s\S]*?array\[([\s\S]*?)\]/.exec(sql)?.[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
same('PUSH_KINDS = push_kinds() миграции 0011', [...PUSH_KINDS].sort(), sqlKinds.sort())

// ── pushView ───────────────────────────────────────────────────────────────────────
const NOW = new Date('2026-10-15T13:10:00Z')
const soonNote = { id: 'n1', kind: 'lesson_soon', data: { lesson: L, at: '2026-10-15T14:00:00Z', href: `/lessons?lesson=${L}` }, created_at: '2026-10-15T13:00:00Z' }
const v = pushView(soonNote, NOW)
check('урок через час: срок доставки — до начала урока, один на урок', v?.ttl === 50 * 60 && v.tag === `lesson-${L}` && v.urgency === 'high', JSON.stringify(v))
check('урок уже начался — не шлём', pushView(soonNote, new Date('2026-10-15T14:00:01Z')) === null)
check('не об уроке (сообщение учителя, тариф) — не шлём', pushView({ id: 'x', kind: 'teacher_message', data: { text: 'Оплата' }, created_at: '' }, NOW) === null &&
  pushView({ id: 'y', kind: 'plan_ending', data: {}, created_at: '' }, NOW) === null)
check('серия — один на серию, сутки на доставку', pushView({ id: 'z', kind: 'lessons_cancelled', data: { series: S, weekdays: [2] }, created_at: '' }, NOW)?.tag === `series-${S}` &&
  pushView({ id: 'z', kind: 'lessons_cancelled', data: { series: S }, created_at: '' }, NOW)?.ttl === 86400)

// ── шифрование: расшифровать, как телефон ──────────────────────────────────────────────
const vapid = webpush.generateVAPIDKeys()
const CFG = { publicKey: vapid.publicKey, privateKey: vapid.privateKey, subject: 'https://recall-pgkz.vercel.app' }
function browser() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const authSecret = randomBytes(16)
  return { ecdh, authSecret, target: { endpoint: `https://fcm.googleapis.com/fcm/send/${randomBytes(8).toString('hex')}`, p256dh: ecdh.getPublicKey().toString('base64url'), auth: authSecret.toString('base64url') } }
}
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
function decrypt(body, b) {
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const ct = body.subarray(21 + idlen)
  const uaPublic = b.ecdh.getPublicKey()
  const secret = b.ecdh.computeSecret(asPublic)
  const prkKey = hmac(b.authSecret, secret)
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(ct.subarray(ct.length - 16))
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()])
  let end = plain.length - 1
  while (end >= 0 && plain[end] === 0) end--
  if (plain[end] !== 2) throw new Error('нет разделителя последней записи')
  return JSON.parse(plain.subarray(0, end).toString('utf8'))
}
function vapidOk(header, endpoint) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header ?? '')
  if (!m || m[2] !== CFG.publicKey) return false
  const [h, p, sig] = m[1].split('.')
  const pub = Buffer.from(CFG.publicKey, 'base64url')
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' })
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
  const exp = claims.exp * 1000 - Date.now()
  return verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')) &&
    claims.aud === new URL(endpoint).origin && claims.sub === CFG.subject && exp > 0 && exp <= 24 * 3600_000
}

const b1 = browser()
const sent = []
const fakeSend = (status) => async (url, init) => (sent.push({ url, init }), typeof status === 'function' ? status(url) : status)
const ch = pushChannel(CFG, fakeSend(201), () => NOW)
const r1 = await ch.deliver({ ...soonNote, user_id: 'u', push: [b1.target] })
const got = sent[0] ? decrypt(sent[0].init.body, b1) : null
same('телефон расшифровал то, что отправлено', got, { title: 'Урок через час', body: '19:00', href: `/lessons?lesson=${L}`, tag: `lesson-${L}` })
check('подпись VAPID верна: адресат — служба push, подписчик — сайт, срок ≤ суток', vapidOk(sent[0]?.init.headers.Authorization, b1.target.endpoint), sent[0]?.init.headers.Authorization)
check('заголовки: TTL до начала урока, срочно, aes128gcm', sent[0]?.init.headers.TTL === 3000 && sent[0]?.init.headers.Urgency === 'high' && sent[0]?.init.headers['Content-Encoding'] === 'aes128gcm', JSON.stringify(sent[0]?.init.headers))
same('итог — «ушло»', r1, { outcome: 'sent', gone: [] })

// ── ответы службы push ───────────────────────────────────────────────────────────────
same('коды: 201 ушло, 410/404 подписки нет, 429/503 повтор, 400 ошибка', [201, 410, 404, 429, 503, 400].map(classify), ['ok', 'gone', 'gone', 'retry', 'retry', 'error'])
const moved = { id: 'n2', user_id: 'u', kind: 'lesson_moved', data: { lesson: L, from: '2026-10-22T14:00:00Z', to: '2026-10-23T13:00:00Z' }, created_at: '2026-10-15T13:00:00Z' }
const b2 = browser()
const b3 = browser()
same('одно устройство удалено (410), другое получило — «ушло», подписку удалить',
  await pushChannel(CFG, fakeSend((u) => (u === b2.target.endpoint ? 410 : 201)), () => NOW).deliver({ ...moved, push: [b2.target, b3.target] }),
  { outcome: 'sent', gone: [b2.target.endpoint] })
same('429 — «не дошло», повтор', await pushChannel(CFG, fakeSend(429), () => NOW).deliver({ ...moved, push: [b3.target] }), { outcome: 'failed', gone: [] })
same('сбой связи — повтор', await pushChannel(CFG, async () => { throw new Error('ECONNRESET') }, () => NOW).deliver({ ...moved, push: [b3.target] }), { outcome: 'failed', gone: [] })
same('400 — без повтора', await pushChannel(CFG, fakeSend(400), () => NOW).deliver({ ...moved, push: [b3.target] }), { outcome: 'failed', gone: [], retry: false })
same('негодные ключи подписки — удалить её', await pushChannel(CFG, fakeSend(201), () => NOW).deliver({ ...moved, push: [{ ...b3.target, p256dh: 'AAAA' }] }),
  { outcome: 'skipped', gone: [b3.target.endpoint], retry: false })
same('сломанный ключ VAPID — подписки НЕ удаляются, без повтора', await pushChannel({ ...CFG, privateKey: 'xx' }, fakeSend(201), () => NOW).deliver({ ...moved, push: [b3.target] }),
  { outcome: 'failed', gone: [], retry: false })
same('нет ключей, нет подписок, не для push — «пропущено»', [
  await pushChannel(null, fakeSend(201), () => NOW).deliver({ ...moved, push: [b3.target] }),
  await pushChannel(CFG, fakeSend(201), () => NOW).deliver({ ...moved, push: [] }),
  await pushChannel(CFG, fakeSend(201), () => NOW).deliver({ ...moved, kind: 'teacher_message', push: [b3.target] }),
].map((r) => r.outcome), ['skipped', 'skipped', 'skipped'])
same('адрес службы: https и доменное имя', ['https://fcm.googleapis.com/x', 'http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://a.local/x'].map(endpointOk), [true, false, false, false, false])

// ── сервер доставки → база: gone и retry ──────────────────────────────────────────────
process.env.NOTIFY_SECRET = 'test-secret-123'
const res = { code: 0, payload: null, status(c) { this.code = c; return this }, json(p) { this.payload = p; return this } }
const b4 = browser()
const send4 = fakeSend((u) => (u === b4.target.endpoint ? 410 : 503))
await handle({ method: 'POST', headers: { authorization: 'Bearer test-secret-123' }, body: { notifications: [
  { ...moved, id: 'a', push: [b4.target] },
  { ...moved, id: 'b', push: [b3.target] },
  { ...moved, id: 'c', kind: 'manual', push: [] },
] } }, res, [pushChannel(CFG, send4, () => NOW)])
same('ответ базе: мёртвая подписка — в gone, временный сбой — в retry', { gone: res.payload?.gone, retry: res.payload?.retry, results: res.payload?.results?.push },
  { gone: [b4.target.endpoint], retry: ['b'], results: { sent: 0, skipped: 2, failed: 1 } })
const bad = { code: 0, status(c) { this.code = c; return this }, json() { return this } }
await handle({ method: 'POST', headers: { authorization: 'Bearer test-secret-123' }, body: { notifications: [{ ...moved, push: [{ endpoint: 1 }] }] } }, bad, [])
check('кривые подписки в теле — 400', bad.code === 400)

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
