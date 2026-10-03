/**
 * Правила оплаты src/domains/billing/model.ts (PLAN.md Ф2.1).
 *
 *   • продление: истёкший — от сейчас, действующий — от даты окончания, на
 *     пробном — от конца пробного; «free» с датой окончания не считается
 *     действующим; месяцы по Алматы с концом месяца (31.01 → 28.02);
 *     сверка с сервером — check-billing.mjs;
 *   • что показать на «Как оплатить»: тарифы по роли и по ссылке, выбор сразу;
 *   • строка «Сейчас: …» и предупреждения владельцу перед «Подтвердить»;
 *   • сумма = цена × месяцы, а цена — та, что на странице тарифов;
 *   • конец доступа (Ф2.4): репетитору — тариф репетитора или пробный, что
 *     позже, остальным — свой тариф; плашка «закончился» — только после
 *     конца, ученику в студии — нет (сверка с базой — check-access-ending).
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-billing.mjs
 */
import {
  accessEnd,
  accessEndedNotice,
  addMonthsAlmaty,
  amountFor,
  confirmWarnings,
  dayLabel,
  initialPlanToPay,
  planNow,
  planNowLabel,
  PLANS,
  plansToPay,
  planName,
  planShortTitle,
  teacherTrialStatus,
  termAfterPayment,
  termStart,
} from '../src/domains/billing/model.ts'

let fail = 0
let total = 0
const check = (name, got, want) => {
  total++
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ждали ${JSON.stringify(want)}, получили ${JSON.stringify(got)}`}`)
}

const now = new Date('2026-10-03T10:00:00+05:00')
const iso = (s) => new Date(s).toISOString()
const state = (plan, expires, trial) => ({ plan, plan_expires_at: expires && iso(expires), trial_until: trial && iso(trial) })

// ── продление ────────────────────────────────────────────────────────────────
check('истёкший тариф — от сейчас', termStart(state('teacher_mini', '2026-09-20T00:00:00+05:00', null), now).toISOString(), now.toISOString())
check('не было тарифа и пробного — от сейчас', termStart(state('free', null, null), now).toISOString(), now.toISOString())
check(
  'действующий — от даты окончания',
  termStart(state('teacher_mini', '2026-10-16T12:00:00+05:00', null), now).toISOString(),
  iso('2026-10-16T12:00:00+05:00'),
)
check(
  'на пробном — от конца пробного (дни пробного не сгорают)',
  termStart(state('free', null, '2026-10-10T09:00:00+05:00'), now).toISOString(),
  iso('2026-10-10T09:00:00+05:00'),
)
check(
  'действующий и пробный — от более поздней даты',
  termStart(state('premium', '2026-10-20T00:00:00+05:00', '2026-10-10T00:00:00+05:00'), now).toISOString(),
  iso('2026-10-20T00:00:00+05:00'),
)
check(
  '«free» со старой датой окончания не продлевает от неё',
  termStart(state('free', '2026-12-01T00:00:00+05:00', null), now).toISOString(),
  now.toISOString(),
)
check('+1 месяц: 16 октября → 16 ноября', addMonthsAlmaty(new Date('2026-10-16T12:00:00+05:00'), 1).toISOString(), iso('2026-11-16T12:00:00+05:00'))
check('31 января → 28 февраля (дня нет — последний)', addMonthsAlmaty(new Date('2027-01-31T23:30:00+05:00'), 1).toISOString(), iso('2027-02-28T23:30:00+05:00'))
check('ночь 1 марта по Алматы → 1 апреля', addMonthsAlmaty(new Date('2027-03-01T02:00:00+05:00'), 1).toISOString(), iso('2027-04-01T02:00:00+05:00'))
check('+12 месяцев через високосный февраль', addMonthsAlmaty(new Date('2028-02-29T10:00:00+05:00'), 12).toISOString(), iso('2029-02-28T10:00:00+05:00'))
check(
  'срок оплаты на пробном: начало и конец',
  (({ start, end }) => [start.toISOString(), end.toISOString()])(termAfterPayment(state('free', null, '2026-10-10T09:00:00+05:00'), 2, now)),
  [iso('2026-10-10T09:00:00+05:00'), iso('2026-12-10T09:00:00+05:00')],
)

// ── что показать на «Как оплатить» ───────────────────────────────────────────
check('репетитору — три тарифа репетитора', plansToPay('teacher'), ['teacher_mini', 'teacher_start', 'teacher_pro'])
check('ученику — Premium', plansToPay('learner'), ['premium'])
check('роль неизвестна — Premium', plansToPay(null), ['premium'])
check('ученик со ссылкой на тариф репетитора — тарифы репетитора', plansToPay('learner', 'teacher_start'), ['teacher_mini', 'teacher_start', 'teacher_pro'])
check('репетитор со ссылкой на Premium — Premium', plansToPay('teacher', 'premium'), ['premium'])
check('мусор в ссылке — по роли', plansToPay('teacher', 'gold'), ['teacher_mini', 'teacher_start', 'teacher_pro'])
const teacherOptions = plansToPay('teacher')
check('выбран тариф из ссылки', initialPlanToPay(teacherOptions, 'teacher_mini', 'teacher_pro'), 'teacher_pro')
check('без ссылки — нынешний', initialPlanToPay(teacherOptions, 'teacher_start', null), 'teacher_start')
check('нынешний не из списка — первый', initialPlanToPay(teacherOptions, 'free', null), 'teacher_mini')
check('«Репетитор · Mini» → «Mini»', planShortTitle('teacher_mini'), 'Mini')
check('Premium без приставки — как есть', planShortTitle('premium'), 'Premium')

// ── суммы ────────────────────────────────────────────────────────────────────
check('сумма = цена × месяцы', amountFor('teacher_start', 3), 19500)
check('цены тарифов — как на странице тарифов', PLANS.filter((p) => p.price > 0).map((p) => [p.id, p.price]), [
  ['premium', 1990],
  ['teacher_mini', 3900],
  ['teacher_start', 6500],
  ['teacher_pro', 14990],
])

// ── «Сейчас: …» ──────────────────────────────────────────────────────────────
check('оплачен', planNowLabel(state('teacher_mini', '2026-10-16T12:00:00+05:00', null), now), 'Репетитор · Mini, действует до 16 октября')
check('пробный', planNowLabel(state('free', null, '2026-10-10T09:00:00+05:00'), now), 'пробный период до 10 октября')
check('закончился', planNowLabel(state('teacher_mini', '2026-09-16T12:00:00+05:00', null), now), 'Репетитор · Mini, закончился 16 сентября')
check('ничего не было', planNowLabel(state('free', null, '2026-09-01T00:00:00+05:00'), now), 'бесплатный тариф')
check('оплаченный важнее пробного', planNow(state('premium', '2026-11-01T00:00:00+05:00', '2026-10-10T00:00:00+05:00'), now).kind, 'paid')
check('другой год — с годом', /2027/.test(dayLabel(new Date('2027-01-05T12:00:00+05:00'), now)), true)
check('день — по Алматы, а не по часам устройства', dayLabel(new Date('2026-10-15T20:30:00Z'), now), '16 октября')

// ── предупреждения владельцу ──────────────────────────────────────────────────
check(
  'понижение при действующем — предупредить',
  confirmWarnings(state('teacher_pro', '2026-10-16T12:00:00+05:00', null), 'teacher_mini', 3, now),
  ['Сейчас Репетитор · Pro до 16 октября — после подтверждения сразу станет Репетитор · Mini.'],
)
check('повышение — без предупреждения', confirmWarnings(state('teacher_mini', '2026-10-16T12:00:00+05:00', null), 'teacher_pro', 3, now), [])
check('понижение после окончания — без предупреждения', confirmWarnings(state('teacher_pro', '2026-09-16T12:00:00+05:00', null), 'teacher_mini', 3, now), [])
check(
  'учеников больше, чем мест',
  confirmWarnings(state('free', null, null), 'teacher_mini', 7, now),
  ['Учеников 7, а мест в тарифе 5: 2 останутся без повышенных лимитов AI.'],
)
check('Premium мест не считает', confirmWarnings(state('free', null, null), 'premium', 7, now), [])

// ── метка пробного репетитора (Ф2.2) ─────────────────────────────────────────
const trial = (until, started, extra = {}) => ({ ...state('free', null, until), trial_started: started, trial_days: 14, ...extra })
check(
  'до первого ученика, до потолка 20 дней — «14 дней с первого ученика»',
  teacherTrialStatus(trial('2026-10-23T10:00:00+05:00', false), now),
  { kind: 'before_first', days: 14 },
)
check(
  'до первого ученика, но до потолка 5 дней — честно «осталось 5»',
  teacherTrialStatus(trial('2026-10-08T12:00:00+05:00', false), now),
  { kind: 'left', days: 5 },
)
check(
  'по рефералке — «21 день с первого ученика»',
  teacherTrialStatus(trial('2026-10-30T10:00:00+05:00', false, { trial_days: 21 }), now),
  { kind: 'before_first', days: 21 },
)
check('отсчёт пошёл — сколько дней осталось', teacherTrialStatus(trial('2026-10-08T09:00:00+05:00', true), now), { kind: 'left', days: 5 })
check('кончается сегодня вечером — 0 (последний день)', teacherTrialStatus(trial('2026-10-03T23:00:00+05:00', true), now), { kind: 'left', days: 0 })
check('дни — по Алматы: завтра в 00:30 по Алматы — это 1 день', teacherTrialStatus(trial('2026-10-03T19:30:00Z', true), now), { kind: 'left', days: 1 })
check('пробный кончился — метки нет', teacherTrialStatus(trial('2026-10-01T10:00:00+05:00', true), now), null)
check(
  'оплачен тариф репетитора — метки нет',
  teacherTrialStatus({ ...trial('2026-10-20T10:00:00+05:00', true), plan: 'teacher_mini', plan_expires_at: iso('2026-11-03T10:00:00+05:00') }, now),
  null,
)
check(
  'Premium пробный репетитора не отменяет',
  teacherTrialStatus({ ...trial('2026-10-08T09:00:00+05:00', true), plan: 'premium', plan_expires_at: iso('2026-11-03T10:00:00+05:00') }, now),
  { kind: 'left', days: 5 },
)
check('старая база без полей пробного — как «отсчёт пошёл»', teacherTrialStatus(state('free', null, '2026-10-08T09:00:00+05:00'), now), { kind: 'left', days: 5 })

// ── конец доступа: напоминание и плашка (Ф2.4) ─────────────────────────────────
const at = (s) => (s ? iso(s) : null)
const st = (plan, expires, trial, extra = {}) => ({ plan, plan_expires_at: at(expires), trial_until: at(trial), ...extra })
const end = (a) => a && { ...a, until: a.until.toISOString() }
check('имя тарифа во фразе — без точки', [planName('teacher_mini'), planName('premium')], ['Репетитор Mini', 'Premium'])
check(
  'репетитор на пробном — конец пробного',
  end(accessEnd('teacher', st('free', null, '2026-10-16T10:00:00+05:00'))),
  { source: 'trial', until: iso('2026-10-16T10:00:00+05:00') },
)
check(
  'репетитор оплатил на пробном — тариф позже, держит он',
  end(accessEnd('teacher', st('teacher_mini', '2026-11-16T10:00:00+05:00', '2026-10-16T10:00:00+05:00'))),
  { source: 'plan', plan: 'teacher_mini', until: iso('2026-11-16T10:00:00+05:00') },
)
check(
  'тариф репетитора кончился раньше пробного — держит пробный',
  end(accessEnd('teacher', st('teacher_start', '2026-10-05T10:00:00+05:00', '2026-10-16T10:00:00+05:00'))),
  { source: 'trial', until: iso('2026-10-16T10:00:00+05:00') },
)
check(
  'репетитору Premium не в счёт (расписание он не открывает)',
  end(accessEnd('teacher', st('premium', '2026-12-01T10:00:00+05:00', '2026-10-16T10:00:00+05:00'))),
  { source: 'trial', until: iso('2026-10-16T10:00:00+05:00') },
)
check(
  'самоучка с Premium — конец Premium, пробный не в счёт',
  end(accessEnd('learner', st('premium', '2026-10-16T10:00:00+05:00', '2026-10-20T10:00:00+05:00'))),
  { source: 'plan', plan: 'premium', until: iso('2026-10-16T10:00:00+05:00') },
)
check('ученик на пробном — не в счёт', accessEnd('learner', st('free', null, '2026-10-16T10:00:00+05:00')), null)
check('репетитор без пробного и тарифа — ничего', accessEnd('teacher', st('free', null, null)), null)

const later = new Date('2026-10-20T12:00:00+05:00')
check(
  'тариф репетитора кончился — «Тариф закончился», имя и дата',
  accessEndedNotice('teacher', st('teacher_mini', '2026-10-16T10:00:00+05:00', '2026-09-01T10:00:00+05:00'), later),
  { source: 'plan', title: 'Тариф закончился', body: 'Репетитор Mini · до 16 октября. Всё сохранено', action: 'Продлить' },
)
check(
  'пробный кончился — «Пробный период закончился», «Выбрать тариф»',
  accessEndedNotice('teacher', st('free', null, '2026-10-16T10:00:00+05:00'), later),
  { source: 'trial', title: 'Пробный период закончился', body: 'Всё сохранено', action: 'Выбрать тариф' },
)
check(
  'в день окончания до самого момента — тариф ещё действует, плашки нет',
  accessEndedNotice('teacher', st('teacher_mini', '2026-10-16T14:30:00+05:00', null), new Date('2026-10-16T09:00:00+05:00')),
  null,
)
check(
  'в тот же день после момента — плашка',
  accessEndedNotice('teacher', st('teacher_mini', '2026-10-16T14:30:00+05:00', null), new Date('2026-10-16T14:31:00+05:00'))?.title,
  'Тариф закончился',
)
check(
  'продлили — плашки нет',
  accessEndedNotice('teacher', st('teacher_mini', '2026-11-16T10:00:00+05:00', '2026-09-01T10:00:00+05:00'), later),
  null,
)
check(
  'самоучке — про его Premium',
  accessEndedNotice('learner', st('premium', '2026-10-16T10:00:00+05:00', null, { in_studio: false }), later)?.body,
  'Premium · до 16 октября. Всё сохранено',
)
check(
  'ученику в студии репетитора — ничего: его держит студия',
  accessEndedNotice('learner', st('premium', '2026-10-16T10:00:00+05:00', null, { in_studio: true }), later),
  null,
)
check('ученику без тарифа после пробного — ничего', accessEndedNotice('learner', st('free', null, '2026-10-01T10:00:00+05:00'), later), null)
check(
  'репетитору «в студии» (свой пул) плашка всё равно положена',
  accessEndedNotice('teacher', st('free', null, '2026-10-16T10:00:00+05:00', { in_studio: true }), later)?.source,
  'trial',
)
check(
  'в другом году — с годом и без второй точки после «г.»',
  accessEndedNotice('teacher', st('teacher_pro', '2026-12-20T10:00:00+05:00', null), new Date('2027-01-05T10:00:00+05:00'))?.body,
  'Репетитор Pro · до 20 декабря 2026 г. Всё сохранено',
)

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
