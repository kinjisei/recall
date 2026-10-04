// Парадная дверь раздела «Расписание» (архитектура §2): экран /schedule, а для
// карточки ученика в студии — блок «Уроки» (остаток, оплата, история) и
// «Требуют внимания» на компьютере (Ф2.8). Адрес подключает каркас лениво.
export { AttentionPanel } from './AttentionPanel'
export { BalanceCount, CardLessons } from './CardLessons'
export { SchedulePage } from './SchedulePage'
