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
