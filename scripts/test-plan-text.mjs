/**
 * Имя недели программы (src/features/program/planText.ts, макет d11-3,
 * PLAN.md Ф2.17-4г-1): «Неделя 1  связки и буксующие слова» — номер слева,
 * справа — заголовок AI без «Неделя 1:».
 *
 * ⚠️ Ожидания — литералами.
 *
 * Запуск: node scripts/test-plan-text.mjs
 */
import { weekName } from '../src/features/program/planText.ts'

let pass = 0
let fail = 0
const check = (name, got, want) => {
  const ok = got === want
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — «${got}», ждали «${want}»`}`)
}
const w = (title, focus = 'фокус недели') => ({ title, focus, items: [] })

check('«Неделя 1: …» — без номера', weekName(w('Неделя 1: связки и буксующие слова')), 'связки и буксующие слова')
check('тире и строчная «неделя»', weekName(w('неделя 12 — письмо Task 2')), 'письмо Task 2')
check('точка после номера', weekName(w('Неделя 3. Собеседование')), 'Собеседование')
check('без «Неделя N» — заголовок как есть', weekName(w('Работа и опыт')), 'Работа и опыт')
check('только номер — фокус недели', weekName(w('Неделя 2')), 'фокус недели')
check('пустой заголовок — фокус недели', weekName(w('')), 'фокус недели')
check('«Неделями» внутри названия не трогаем', weekName(w('Повтор за неделю 2')), 'Повтор за неделю 2')

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
