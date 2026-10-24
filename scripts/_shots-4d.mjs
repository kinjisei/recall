// ============================================================================
// Снимки захода 4д-4а (PLAN.md Ф2.17-4д-4а, итоговая сверка) для
// shots-screens.mjs — отдельным модулем, чтобы общий скрипт не рос.
//
//   schedule-day  — «Расписание» Мадины, день ближайшего урока: на телефоне
//                   списком — вид по умолчанию (t1-1), на компьютере колонкой;
//   schedule-day-cols — тот же день лентой часов (t2-1, t7-4);
//   schedule-week — неделя: на телефоне списком — вид по умолчанию (t2-2),
//                   на компьютере — сетка на всю ширину (d1);
//   schedule-week-cols — неделя колонками на телефоне: мини-сетка (t2-2).
// Уроки — из засеянной студии (`_seed-studio.mjs`): Айгерим в 19:00 и на
// неделе, Әсел, серии «IELTS вечер», пробный. AI не вызывается.
// ============================================================================

const NAMES = /Айгерим|Әсел|Камила|Мейір|Тимур|Алина|Нұрсұлтан/

export async function shotsSchedule({ screen, sql, t }) {
  // день — тот, где ближайший урок: вечерний прогон после 18:00 сдвигает
  // засеянный урок на завтра, и «сегодня» было бы пустым
  const [{ day }] = await sql(`select to_char(min(starts_at) at time zone 'Asia/Almaty', 'YYYY-MM-DD') as day
    from public.lessons where teacher_id = '${t.id}' and starts_at > now()`)
  await screen(t.email, [
    { name: 'schedule-day', path: `/schedule?view=day&day=${day}`, expect: /Сегодня/, wait: NAMES },
    { name: 'schedule-day-cols', path: `/schedule?view=day&day=${day}&layout=cols`, expect: /Сегодня/, wait: NAMES },
    { name: 'schedule-week', path: '/schedule?view=week', expect: /Сегодня/, wait: NAMES },
    { name: 'schedule-week-cols', path: '/schedule?view=week&layout=cols', expect: /Сегодня/, wait: NAMES },
  ])
}

// ── 4д-4б: упражнение (d5) ────────────────────────────────────────────────
//   exercise         — «Перевод слова» у Айгерим: вопрос, ничего не выбрано;
//   exercise-chosen  — выбран второй вариант, «Проверить» ещё не нажата (d5-1;
//                      на телефоне ответ одним нажатием — там уже итог);
//   exercise-checked — выбран и проверен первый вариант (d5-2 или d5-3 —
//                      смотря, верный ли он: ответы перемешаны);
//   exercise-<режим> — остальные игры «Практики» в той же рамке раунда
//                      (содержимое по d5 — 4д-4б-2): Значения, Спринт,
//                      Диктант, Собери фразу, «Выбери форму».
// Слова — колода «Мой словарь» из засеянной студии. AI не вызывается.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const openMode = (title, after, ready = 'button[data-key="1"]') => async (page) => {
  await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t))?.click(), title)
  await page.waitForSelector(ready, { timeout: 10000 }).catch(() => {})
  // «Готовим раунд» — не заглушка-скелет, waitForData его не видит
  await page.waitForFunction(() => !document.body.innerText.includes('Готовим раунд'), { timeout: 15000 }).catch(() => {})
  await sleep(800)
  if (after) await after(page)
}
const chooseSecond = async (page) => {
  await page.click('button[data-key="2"]')
  await sleep(500)
}
const checkFirst = async (page) => {
  await page.click('button[data-key="1"]')
  await sleep(300)
  // двухшаговый раунд (d5): «Проверить»; одношаговый проверяет сразу
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Проверить'))?.click())
  await sleep(700)
}

export async function shotsExercise({ screen, a }) {
  await screen(a.email, [
    { name: 'exercise', path: '/practice?g=words', expect: /Перевод слова/, prepare: openMode('Перевод слова') },
    { name: 'exercise-chosen', path: '/practice?g=words', expect: /Перевод слова/, prepare: openMode('Перевод слова', chooseSecond) },
    { name: 'exercise-checked', path: '/practice?g=words', expect: /Перевод слова/, prepare: openMode('Перевод слова', checkFirst) },
    { name: 'exercise-match', path: '/practice?g=words', expect: /Значения/, prepare: openMode('Значения', null, 'h1') },
    { name: 'exercise-sprint', path: '/practice?g=words', expect: /Спринт/, prepare: openMode('Спринт', null, 'h1') },
    { name: 'exercise-dictation', path: '/practice?g=words', expect: /Диктант/, prepare: openMode('Диктант', null, 'input') },
    { name: 'exercise-sentence', path: '/practice?g=words', expect: /Собери фразу/, prepare: openMode('Собери фразу', null, 'h1') },
    { name: 'exercise-grammar', path: '/practice?g=grammar', expect: /Выбери форму/, prepare: openMode('Выбери форму') },
  ])
}
