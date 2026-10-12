/**
 * Онбординг репетитора — что сказать из ответов (src/domains/billing/bands.ts,
 * PLAN.md Ф2.11б-4, макет t10, журнал п.73).
 *
 * Держит:
 *   1. «Сколько учеников» → тариф: самый маленький, куда влезают все;
 *      «больше» → Pro и «напиши нам»;
 *   2. пробный — по правилу базы, а не числом из макета: до первого ученика
 *      14 (по рефералке 21), отсчёт пошёл — «осталось N», тариф оплачен или
 *      пробный кончился — ничего не обещаем; режим ещё не включён — 14;
 *   3. тексты карточки «Подойдёт тариф» и строки о пробном, склонение;
 *   4. подписи ответов в /admin («больше 30»).
 *
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-teacher-onboarding.mjs
 */
import {
  bandLabel,
  planForBand,
  planOffer,
  STUDENT_BANDS,
  teacherTrialOffer,
  trialLine,
} from '../src/domains/billing/bands.ts'

const results = []
// в цене между разрядами — неразрывный пробел (toLocaleString): «6 500» не рвётся на две строки
const nb = (s) => s.replace(/(\d) (\d)/g, '$1\u00a0$2')
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`)
}

// 1. ответ → тариф
eq('варианты — как в макете', STUDENT_BANDS.map((b) => b.label), ['1–5', '6–10', '11–30', 'больше'])
eq('1–5 → Mini', planForBand('1-5'), { plan: 'teacher_mini', overflow: false })
eq('6–10 → Start', planForBand('6-10'), { plan: 'teacher_start', overflow: false })
eq('11–30 → Pro', planForBand('11-30'), { plan: 'teacher_pro', overflow: false })
eq('больше → Pro и «напиши нам»', planForBand('30+'), { plan: 'teacher_pro', overflow: true })

// 2. пробный
const now = new Date('2026-10-12T07:00:00Z')
const day = 86400_000
const at = (days) => new Date(now.getTime() + days * day).toISOString()
eq('режим ещё не включён — 14 дней с первого ученика', teacherTrialOffer(false, null, now), { kind: 'before_first', days: 14 })
eq('тариф не прочитался — тоже 14', teacherTrialOffer(true, null, now), { kind: 'before_first', days: 14 })
eq(
  'только что включил режим: до потолка 20 дней — 14 с первого ученика',
  teacherTrialOffer(true, { plan: 'free', plan_expires_at: null, trial_until: at(20), trial_started: false, trial_days: 14 }, now),
  { kind: 'before_first', days: 14 },
)
eq(
  'по рефералке — 21',
  teacherTrialOffer(true, { plan: 'free', plan_expires_at: null, trial_until: at(27), trial_started: false, trial_days: 21 }, now),
  { kind: 'before_first', days: 21 },
)
eq(
  'отсчёт пошёл — осталось N (новое устройство)',
  teacherTrialOffer(true, { plan: 'free', plan_expires_at: null, trial_until: at(9.5), trial_started: true, trial_days: 14 }, now),
  { kind: 'left', days: 10 },
)
eq(
  'тариф репетитора оплачен — ничего не обещаем',
  teacherTrialOffer(true, { plan: 'teacher_start', plan_expires_at: at(30), trial_until: at(3), trial_started: true, trial_days: 14 }, now),
  { kind: 'none' },
)
eq(
  'пробный кончился — ничего не обещаем',
  teacherTrialOffer(true, { plan: 'free', plan_expires_at: null, trial_until: at(-2), trial_started: true, trial_days: 14 }, now),
  { kind: 'none' },
)

// 3. тексты
const fresh = { kind: 'before_first', days: 14 }
eq('строка пробного — как в макете', trialLine(fresh), '14 дней бесплатно — отсчёт пойдёт с первого ученика в приложении')
eq('по рефералке — «21 день»', trialLine({ kind: 'before_first', days: 21 }), '21 день бесплатно — отсчёт пойдёт с первого ученика в приложении')
eq('отсчёт пошёл — «осталось 3 дня»', trialLine({ kind: 'left', days: 3 }), 'Пробный период — осталось 3 дня')
eq('последний день', trialLine({ kind: 'left', days: 0 }), 'Пробный период — последний день')
eq('тариф оплачен — строки нет', trialLine({ kind: 'none' }), null)
eq('карточка 6–10 — как в макете', planOffer('6-10', fresh), {
  title: 'Start',
  students: '10 учеников в приложении',
  price: nb('6 500 ₸ в месяц — после 14 бесплатных дней'),
  overflow: false,
})
eq('карточка 1–5 — Mini, 5 учеников', planOffer('1-5', fresh).students, '5 учеников в приложении')
eq('по рефералке — «после 21 бесплатного дня»', planOffer('11-30', { kind: 'before_first', days: 21 }).price, nb('14 990 ₸ в месяц — после 21 бесплатного дня'))
eq('больше 30 — Pro и «напиши нам»', [planOffer('30+', fresh).title, planOffer('30+', fresh).overflow], ['Pro', true])
eq('отсчёт пошёл — «после пробного периода»', planOffer('6-10', { kind: 'left', days: 4 }).price, nb('6 500 ₸ в месяц — после пробного периода'))
eq('тариф оплачен — цена без хвоста', planOffer('6-10', { kind: 'none' }).price, nb('6 500 ₸ в месяц'))
eq('до ответа — общая карточка', planOffer(null, fresh), {
  title: 'Mini · Start · Pro',
  students: '5, 10 или 30 учеников в приложении',
  price: nb('от 3 900 ₸ в месяц — после 14 бесплатных дней'),
  overflow: false,
})

// 4. подписи для /admin
eq('подписи ответов в /admin', ['1-5', '6-10', '11-30', '30+', 'что-то'].map(bandLabel), ['1–5', '6–10', '11–30', 'больше 30', 'что-то'])

const ok = results.filter(Boolean).length
console.log(`\n${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
