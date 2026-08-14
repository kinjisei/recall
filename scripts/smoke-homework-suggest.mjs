/**
 * Смоук: «Собрать домашку» подбирает набор ПОД УЧЕНИКА, а не вообще.
 *
 * Зачем. Правила подбора проверяет чистый тест (test-homework-suggest.mjs) —
 * он видит арифметику, но не видит главного: доходят ли реальные данные
 * ученика до формы и до промпта. Между правилом и экраном лежат сбор фактов,
 * загрузка словаря и промпт, и сломаться может любое звено, не уронив ни одну
 * проверку.
 *
 * ⚠️ Запрос к AI ПЕРЕХВАТЫВАЕТСЯ и отменяется: смотрим тело и не даём ему уйти.
 * Значит прогон не стоит ни энергии ученика, ни месячных генераций
 * преподавателя. Заодно это проверяет запасной путь: подбор обязан отработать
 * и без модели — состав считают данные, модель только пишет формулировки.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-homework-suggest.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const T_EMAIL = 'hwsug-teacher@recall.test'
const S_EMAIL = 'hwsug-student@recall.test'
const PASSWORD = 'HwSug!Smoke2026'
const STUDENT_NAME = 'Асель Подборова'
/** Слово со срывами — обязано доехать до промпта. */
const HARD_WORD = 'whisper'
/** Тема грамматики с ошибкой — обязана стать темой квеста. */
const MISTAKE_TOPIC = 0
/** Столько карточек делаем просроченными: число попадёт в объяснение пункта. */
const OVERDUE = 12

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)
const waitText = (page, t, ms = 20000) =>
  page
    .waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms, polling: 250 }, t)
    .then(() => true)
    .catch(() => false)
/**
 * Счёт «0 из 4» ищем по ТОЧНОМУ тексту элемента, а не вхождением в страницу.
 *
 * ⚠️ Поймано на себе: строка словарного пункта показывает «0 из 44», и
 * includes('0 из 4') находит её. Проверка была зелёной, хотя счёт группы не
 * работал вовсе — заголовок в тот момент честно показывал «0 из 5».
 */
const waitExact = (page, text, ms = 20000) =>
  page
    .waitForFunction(
      (x) =>
        [...document.querySelectorAll('span, p, div')].some(
          (e) => (e.textContent || '').trim() === x,
        ),
      { timeout: ms, polling: 250 },
      text,
    )
    .then(() => true)
    .catch(() => false)
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find(
      (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(800)
  return ok
}

async function makeUser(email, role, name, patch = {}) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  for (const u of list.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(u.id)
  const { data } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  })
  await admin.from('profiles').update({ role, display_name: name, ...patch }).eq('id', data.user.id)
  return data.user.id
}

let tId, sId, browser
try {
  tId = await makeUser(T_EMAIL, 'teacher', 'Смоук-Педагог')
  sId = await makeUser(S_EMAIL, 'learner', STUDENT_NAME, { level: 'A2', goal: 'exam' })
  await admin.from('teacher_students').insert({ teacher_id: tId, student_id: sId, seat: true })

  // ---- сеем данные, из которых и должен собраться набор ---------------------
  const { data: deck } = await admin
    .from('decks')
    .select('id')
    .eq('owner_id', sId)
    .eq('lang', 'en')
    .limit(1)
    .single()
  const past = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data: cards } = await admin
    .from('cards')
    .insert([
      { deck_id: deck.id, front: HARD_WORD, back: 'шептать', source: 'manual' },
      ...Array.from({ length: OVERDUE - 1 }, (_, i) => ({
        deck_id: deck.id,
        front: `word${String.fromCharCode(97 + i)}`,
        back: `перевод ${i}`,
        source: 'manual',
      })),
    ])
    .select('id')
  // все просрочены; первое ещё и буксует (lapses ≥ 2 → «буксующие»)
  await admin.from('review_states').insert(
    cards.map((c, i) => ({
      user_id: sId,
      card_id: c.id,
      state: i === 0 ? 'relearning' : 'review',
      due: past,
      last_review: past,
      reps: 5,
      lapses: i === 0 ? 4 : 0,
      stability: 2,
      difficulty: 5,
    })),
  )
  await admin
    .from('grammar_mistakes')
    .insert({ user_id: sId, lang: 'en', topic_id: MISTAKE_TOPIC, ex: 1 })
  check('ученик, карточки и ошибки заведены', cards.length === OVERDUE, `карточек: ${cards.length}`)

  const genBefore = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('pool_owner', tId)
    .eq('is_generation', true)

  // ---- браузер --------------------------------------------------------------
  const port = 9750 + Math.floor(Math.random() * 200)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('hwsug')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 40 && !browser; i++) {
    try {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` })
    } catch {
      await sleep(500)
    }
  }
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(e.message))

  // ПЕРЕХВАТ на уровне fetch, а не setRequestInterception: перехват уровня
  // puppeteer требует вручную пропускать КАЖДЫЙ запрос, и dev-сервер с его
  // websocket-ами на этом подвисает.
  await page.evaluateOnNewDocument(`
    try { localStorage.setItem('recall.onboarded', '1') } catch {}
    window.__aiCalls = [];
    const orig = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes('/api/gemini')) {
        window.__aiCalls.push(String((init && init.body) || ''));
        return Promise.reject(new Error('перехвачено смоуком'));
      }
      return orig(input, init);
    };
  `)

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(page, 'Войти')
  await page.type('#f-email', T_EMAIL)
  await page.type('#f-password', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 20000, polling: 250 })

  await page.goto(`${BASE}/teacher?student=${sId}`, { waitUntil: 'networkidle2', timeout: 30000 })
  check('карточка ученика открылась', await waitText(page, STUDENT_NAME))
  await tap(page, 'Собрать домашку')
  check('шторка сборки открылась', await waitText(page, 'Сдать до'))
  check('кнопка подбора на месте', await seen(page, 'Подобрать под ученика'))

  // ---- 1. подбор: что уходит в промпт ---------------------------------------
  await tap(page, 'Подобрать под ученика')
  // словарь грузится отдельным чанком — ждём завершения, а не фиксированную паузу
  await page.waitForFunction(() => (window.__aiCalls || []).length > 0, {
    timeout: 40000,
    polling: 250,
  })
  const calls = await page.evaluate(() => window.__aiCalls || [])
  const body = calls.join('\n')
  check('запрос к AI ушёл', calls.length > 0, `запросов: ${calls.length}`)

  // ⚠️ Тип задачи важен: material/program уходят на дефицитные Pro-модели.
  // Сборка домашки не должна их жечь — состав считают данные, а не модель.
  let task = ''
  try {
    task = JSON.parse(calls[0]).task
  } catch {}
  check('задача помечена как homework, а не material/program', task === 'homework', task || '—')

  check(
    'в промпте общий блок диагностики',
    /Что известно про этого ученика/.test(body),
    /Что известно про этого ученика/.test(body) ? '' : body.slice(0, 120),
  )
  check('буксующее слово ученика доехало', body.includes(HARD_WORD))
  check('слабая тема грамматики доехала', /Слабые темы грамматики/.test(body))
  check('цель обучения доехала', /подготовка к экзамену/.test(body))
  check(
    'модели прямо сказано, что состав менять нельзя',
    /СОСТАВ НАБОРА УЖЕ ПОСЧИТАН/.test(body) && /не меняешь числа/.test(body),
  )
  check(
    'объём новых слов в промпте — из правил (32 за неделю)',
    /выучить 32 новых/.test(body) || /32 новых/.test(body),
    /(\d+) новых/.exec(body)?.[1] ?? '—',
  )
  check('число просроченных карточек — настоящее', body.includes(`${OVERDUE} карточек`), `${OVERDUE}`)
  check('пометка «на выбор» дошла до модели', /на выбор/.test(body))

  // ---- 2. запасной путь: AI отклонён, набор всё равно собран ----------------
  const titles = await page.$$eval('input[aria-label="Что сделать"]', (els) => els.map((e) => e.value))
  check('набор собрался без ответа модели', titles.length === 5, `строк: ${titles.length}`)
  check(
    'и в нём всё, что должно быть: слова, чтение, письмо, речь, квест',
    /слов/i.test(titles.join(' ')) &&
      titles.some((t) => /Прочитать/i.test(t)) &&
      titles.some((t) => /Написать/i.test(t)),
    titles.join(' | '),
  )
  check(
    'подобран конкретный текст, а не «какой-нибудь»',
    titles.some((t) => /Прочитать «/.test(t)),
    titles.find((t) => /Прочитать/.test(t)) ?? '—',
  )
  check(
    'тема квеста взята из ошибок ученика',
    titles.some((t) => /квест по теме/i.test(t)),
    titles.find((t) => /квест/i.test(t)) ?? '—',
  )
  check(
    'честно сказано, что формулировки наши, а не AI',
    await seen(page, 'AI не ответил'),
  )

  // ---- 3. объяснения и группа выбора ---------------------------------------
  check('у пунктов показано основание с настоящим числом', await seen(page, `${OVERDUE} карточек ждут повторения`))
  check('видно потолок новых слов в день', await seen(page, 'потолка 10 слов в день'))
  check('пара «на выбор» помечена', await seen(page, 'ученик сделает одно из двух'))
  check('счётчик считает группу за один пункт', await seen(page, '4 к выполнению'))

  // ---- 4. выдача и то, что доехало до базы ---------------------------------
  check('домашка выдана', await tap(page, 'Выдать домашку'))
  check('карточка показала счёт с группой', await waitExact(page, '0 из 4'))

  const { data: hw } = await admin
    .from('homework')
    .select('id')
    .eq('student_id', sId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  const { data: dbItems, error: itemsErr } = await admin
    .from('homework_items')
    .select('id, kind, title, target, pick_group, chosen_at')
    .eq('homework_id', hw.id)
    .order('pos')
  // ⚠️ Отдельная проверка, а не падение по null: без залитой схемы колонок
  // pick_group/chosen_at в базе нет, и весь блок ниже валился с невнятным
  // «Cannot read properties of null». Причина должна называться сама.
  if (itemsErr) {
    check('колонки выбора есть в базе (залита ли схема?)', false, itemsErr.message)
    throw new Error('docs/schema.sql не залит — дальше проверять нечего')
  }
  const group = dbItems.filter((i) => i.pick_group != null)
  check('в базе ровно два пункта «на выбор» и с одним номером', group.length === 2 && group[0].pick_group === group[1].pick_group, `${group.length}`)
  check('никто ещё ничего не выбрал', group.every((i) => !i.chosen_at))
  const wordsItem = dbItems.find((i) => i.kind === 'words')
  check(
    'объём слов = просроченные + новые по правилам',
    wordsItem.target === OVERDUE + 32,
    `${wordsItem?.target} (ждали ${OVERDUE + 32})`,
  )

  // ---- 5. ученик выбирает ---------------------------------------------------
  const asStudent = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  await asStudent.auth.signInWithPassword({ email: S_EMAIL, password: PASSWORD })
  const { error: chooseErr } = await asStudent.rpc('choose_homework_item', { p_item: group[0].id })
  check('ученик выбрал вариант', !chooseErr, chooseErr?.message ?? '')
  const { data: afterPick } = await admin
    .from('homework_items')
    .select('id, chosen_at')
    .eq('homework_id', hw.id)
    .in('id', [group[0].id, group[1].id])
  const chosen = afterPick.filter((i) => i.chosen_at)
  check('выбран ровно один вариант из пары', chosen.length === 1 && chosen[0].id === group[0].id)

  // ⚠️ Выбор — только там, где есть из чего выбирать. Иначе прямым вызовом RPC
  // можно было бы пометить «выбранным» обычный пункт и запутать преподавателя.
  const plain = dbItems.find((i) => i.pick_group == null)
  const { error: badChoose } = await asStudent.rpc('choose_homework_item', { p_item: plain.id })
  check('обычный пункт «выбрать» нельзя', /RECALL_NOT_A_CHOICE/.test(badChoose?.message ?? ''), badChoose?.message ?? 'ошибки не было')

  // регрессия: галочкой измеримый пункт по-прежнему не закрыть
  const { error: tickErr } = await asStudent.rpc('complete_homework_item', { p_item: wordsItem.id })
  check('галочкой измеримый пункт по-прежнему не закрыть', /RECALL_MEASURED_ITEM/.test(tickErr?.message ?? ''))

  // ---- 5б. Переигрывать выбор после закрытия группы нельзя -----------------
  // ⚠️ Без этого получалось расхождение: ученик делает речь (сервер закрывает
  // пункт), потом жмёт «выбрать квест» — и преподаватель видит «квест · выбрал
  // ученик» с галочкой выполнения, хотя квеста не было.
  await admin
    .from('homework_items')
    .update({ done_at: new Date().toISOString(), done_by: 'server' })
    .eq('id', group[0].id)
  const { error: lateErr } = await asStudent.rpc('choose_homework_item', { p_item: group[1].id })
  check(
    'после закрытия пункта группы выбор не переигрывается',
    /RECALL_CHOICE_DONE/.test(lateErr?.message ?? ''),
    lateErr?.message ?? 'ошибки не было',
  )
  const { data: settled } = await admin
    .from('homework_items')
    .select('id, chosen_at, done_at')
    .eq('homework_id', hw.id)
    .in('id', [group[0].id, group[1].id])
  check(
    'выбранным остался сделанный пункт',
    settled.find((i) => i.chosen_at)?.id === group[0].id,
    settled.map((i) => `${i.id.slice(0, 4)}:${i.chosen_at ? 'выбран' : '—'}`).join(' '),
  )

  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
  check('преподаватель видит, что ученик выбрал', await waitText(page, 'выбрал ученик'))
  check('и видит, от чего ученик отказался', await seen(page, 'вместо:'))

  // ---- 6. прогон не стоил ни одной генерации --------------------------------
  const genAfter = await admin
    .from('ai_calls')
    .select('id', { count: 'exact', head: true })
    .eq('pool_owner', tId)
    .eq('is_generation', true)
  check(
    'ни одной генерации не потрачено — запрос до сервера не дошёл',
    genAfter.count === genBefore.count,
    `было ${genBefore.count}, стало ${genAfter.count}`,
  )

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => {})
  for (const id of [tId, sId]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
  console.log('Тестовые аккаунты удалены.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
  setTimeout(() => process.exit(process.exitCode ?? 0), 500)
}
