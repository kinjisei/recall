// ============================================================================
// Части лендинга /teachers: кнопка на регистрацию, «бумажный» пример отчёта и
// карточки тарифов. Тарифы — из каталога domains/billing, а не своей копией:
// своя копия цен расходится с «Тарифами» и «Как оплатить» при первой правке.
// ============================================================================
import { AppLink } from '../../shared/ui/AppLink'
import { TEACHER_PLANS, planCard, planShortTitle } from '../../domains/billing'

/** Главная кнопка действия — на регистрацию репетитора. */
export function CTA({ label = 'Попробовать 14 дней бесплатно' }: { label?: string }) {
  return (
    <AppLink
      to="/login?role=teacher"
      className="lift inline-flex min-h-13 items-center justify-center rounded-2xl bg-accent px-7 font-medium text-accent-fg"
    >
      {label}
    </AppLink>
  )
}

/**
 * Пример отчёта родителям — «бумага», белая при любой теме (data-theme на
 * блоке). Остаётся на первом экране до снимков в Ф2.20. Комментарий в отчёте
 * учитель пишет сам (teacher/ReportSheet), поэтому не «собирается сам».
 */
export function ReportSample() {
  return (
    <div data-theme="light" className="mt-4 w-full max-w-sm rounded-2xl border border-tint/[0.10] bg-surface p-4 text-left text-fg shadow-raised">
      <p className="text-micro uppercase tracking-widest text-fg-muted">
        Отчёт о занятиях · за месяц
      </p>
      <p className="font-serif text-lg font-bold">Айгерим</p>
      <div className="mt-2 flex flex-col gap-1 text-note">
        <p className="flex justify-between border-b border-line pb-1">
          <span>Дней с занятиями</span>
          <span className="font-semibold">18 <span className="text-success-strong">▲ 6</span></span>
        </p>
        <p className="flex justify-between border-b border-line pb-1">
          <span>Средний балл заданий</span>
          <span className="font-semibold">84% <span className="text-success-strong">▲ 12%</span></span>
        </p>
        <p className="flex justify-between">
          <span>Выучено слов</span>
          <span className="font-semibold">47</span>
        </p>
      </div>
      <p className="mt-2 text-caption text-fg-muted">
        Цифры — из занятий ученика, комментарий — ваш. Родители видят, за что платят.
      </p>
    </div>
  )
}

/** Тариф, с которого советуем начать. Это наша рекомендация, а не «выбор большинства»: статистики выборов нет. */
const ADVISED = 'teacher_start'

const TEACHER_CARDS = TEACHER_PLANS.map(planCard)

/** Самый дешёвый тариф репетитора — для «От 3 900 ₸ в месяц». */
export const MIN_TEACHER_PRICE = Math.min(...TEACHER_CARDS.map((p) => p.price))

export function PlanCards() {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {TEACHER_CARDS.map((p) => {
        const hot = p.id === ADVISED
        const seats = p.studentLimit ?? 1
        return (
          <div
            key={p.id}
            className={`rounded-2xl border p-4 text-center ${hot ? 'border-accent-line bg-accent/10' : 'border-tint/[0.08] bg-surface'}`}
          >
            {hot && (
              <p className="mb-1 text-caption font-medium uppercase tracking-wide text-accent-strong">
                Советуем начать с него
              </p>
            )}
            <p className="font-medium">{planShortTitle(p.id)}</p>
            <p className="mt-1 text-2xl font-semibold">
              {p.price.toLocaleString('ru-RU')} <span className="text-sm font-normal text-fg-muted">₸/мес</span>
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">до {seats} учеников</p>
            <p className="mt-2 text-sm text-accent-strong">
              {Math.round(p.price / seats).toLocaleString('ru-RU')} ₸ за ученика
            </p>
          </div>
        )
      })}
    </div>
  )
}
