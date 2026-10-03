/**
 * Черновики набранного текста (src/shared/lib/drafts.ts, PLAN.md Ф1.14).
 *
 * Ловим то, ради чего они есть: черновик одного человека не достаётся
 * другому на общем телефоне; без входа ничего не пишется; брошенный больше
 * 7 дней назад не всплывает; пустое черновиком не считается; сломанное
 * хранилище (переполнено, битый JSON) экран не роняет; при выходе из аккаунта
 * черновики стираются вместе со всеми recall.* (clearUserLocalData).
 *
 * Запуск: node scripts/test-drafts.mjs
 */
import {
  clearDraft,
  DRAFT_PREFIX,
  DRAFT_TTL_MS,
  isEmptyDraft,
  purgeOldDrafts,
  readDraft,
  setDraftOwner,
  writeDraft,
} from '../src/shared/lib/drafts.ts'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}

/** Подделка localStorage в памяти. */
function memStore() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
    keys: () => [...m.keys()],
  }
}
const T0 = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

// --- владелец -----------------------------------------------------------------------
{
  const s = memStore()
  setDraftOwner(null)
  writeDraft('writing:1', 'текст', T0, s)
  check('без входа черновик не пишется', s.length === 0)
  check('без входа черновик не читается', readDraft('writing:1', T0, s) === null)

  setDraftOwner('teacher')
  writeDraft('writing:1', 'черновик учителя', T0, s)
  check('свой черновик читается', readDraft('writing:1', T0, s) === 'черновик учителя')
  setDraftOwner('student')
  check('черновик другого человека на том же телефоне не виден', readDraft('writing:1', T0, s) === null)
  writeDraft('writing:1', 'черновик ученика', T0, s)
  setDraftOwner('teacher')
  check('свои черновики у двоих не перезаписывают друг друга', readDraft('writing:1', T0, s) === 'черновик учителя')
  check('ключ лежит под recall.* — его стирает выход из аккаунта', s.keys().every((k) => k.startsWith('recall.') && k.startsWith(DRAFT_PREFIX)))
}

// --- срок жизни ------------------------------------------------------------------------
{
  const s = memStore()
  setDraftOwner('u1')
  writeDraft('report:7', 'отчёт', T0, s)
  check('через 6 дней черновик на месте', readDraft('report:7', T0 + 6 * DAY, s) === 'отчёт')
  check('через 7 дней с минутой — не всплывает', readDraft('report:7', T0 + DRAFT_TTL_MS + 60_000, s) === null)
  check('протухший при чтении стирается', s.length === 0)
  writeDraft('report:7', 'отчёт', T0, s)
  writeDraft('report:7', 'отчёт, правка', T0 + 6 * DAY, s)
  check('срок считается от последней правки', readDraft('report:7', T0 + 10 * DAY, s) === 'отчёт, правка')
}

// --- пустое и стирание ---------------------------------------------------------------------
{
  const s = memStore()
  setDraftOwner('u1')
  writeDraft('chat:en', 'Hello', T0, s)
  writeDraft('chat:en', '   ', T0, s)
  check('пробелы — не черновик: стирается', readDraft('chat:en', T0, s) === null && s.length === 0)
  writeDraft('mytext:en', { title: '', body: '' }, T0, s)
  check('форма из пустых полей — не черновик', s.length === 0)
  writeDraft('mytext:en', { title: '', body: 'Some text' }, T0, s)
  check('форма с одним заполненным полем — черновик', readDraft('mytext:en', T0, s)?.body === 'Some text')
  clearDraft('mytext:en', s)
  check('clearDraft стирает', readDraft('mytext:en', T0, s) === null)
  check('isEmptyDraft: число и флаг — не пусто', !isEmptyDraft(0) && !isEmptyDraft(false))
  check('isEmptyDraft: вложенные пустые — пусто', isEmptyDraft({ edits: {}, note: '' }) && isEmptyDraft([]))
  check('isEmptyDraft: правка в глубине — не пусто', !isEmptyDraft({ edits: { 2: { ok: false } }, note: '' }))
}

// --- уборка и поломки ----------------------------------------------------------------------
{
  const s = memStore()
  setDraftOwner('a')
  writeDraft('old', 'старое', T0 - 8 * DAY, s)
  writeDraft('fresh', 'свежее', T0 - DAY, s)
  setDraftOwner('b')
  writeDraft('old-b', 'старое чужое', T0 - 30 * DAY, s)
  s.setItem(`${DRAFT_PREFIX}a.broken`, '{не json')
  s.setItem('recall.lang', 'en')
  const removed = purgeOldDrafts(T0, s)
  check('уборка: протухшие любого владельца и битые — прочь', removed === 3, `убрано ${removed}`)
  setDraftOwner('a')
  check('уборка: свежий черновик и чужие ключи остаются', readDraft('fresh', T0, s) === 'свежее' && s.getItem('recall.lang') === 'en')

  s.setItem(`${DRAFT_PREFIX}a.bad`, 'битый')
  check('битый черновик при чтении — null, а не падение', readDraft('bad', T0, s) === null)
  const full = { ...memStore(), setItem: () => { throw new Error('QuotaExceededError') } }
  let threw = false
  try {
    writeDraft('x', 'текст', T0, full)
  } catch {
    threw = true
  }
  check('переполненное хранилище — без падения', !threw)
}

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
