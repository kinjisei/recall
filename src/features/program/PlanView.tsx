// ============================================================================
// Общий вид программы обучения: недели карточками с пунктами (макет d11-3:
// «Неделя 1  связки и буксующие слова», пункт — вид капсом, название,
// пояснение). Его видят и преподаватель (черновик и сохранённая программа в
// карточке ученика), и ученик (/program) — чтобы обе стороны видели план
// ОДИНАКОВО. Две колонки недель — от 576 px ширины программы.
//
// «Сделал» (миграция 0015, журнал п.76 (9)): ученик отмечает пункт сам —
// нажатием на пункт (onToggle); учитель видит галочку, но не нажимает.
// ============================================================================
import { markKey, type PlanMarks } from '../../lib/studyPlan'
import { IconCheck } from '../../shared/ui/icons'
import type { PlanItemType, PlanWeek } from '../../types'
import { weekName } from './planText'

const ITEM_LABEL: Record<PlanItemType, string> = {
  grammar: 'Грамматика',
  words: 'Слова',
  reading: 'Чтение',
  speech: 'Речь',
  dialog: 'Диалог',
  custom: 'Задание',
}


export function PlanView({
  weeks,
  currentWeek,
  marks,
  onToggle,
  pending,
}: {
  weeks: PlanWeek[]
  /** Текущая неделя (с 1) — метка «сейчас»; без неё недели равны (черновик). */
  currentWeek?: number
  /** Отмеченные учеником пункты. */
  marks?: PlanMarks
  /** Ученик: нажатие отмечает пункт или снимает отметку. */
  onToggle?: (week: number, item: number, done: boolean) => void
  /** Пункт, отметка которого сейчас уходит в базу. */
  pending?: string | null
}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-2.5 @xl:grid-cols-2" data-plan-weeks>
        {weeks.map((w, wi) => {
          const n = wi + 1
          return (
            <section key={n} aria-label={`Неделя ${n}`} className="flex flex-col gap-2 rounded-control-lg bg-surface px-4 py-3.5 shadow-card">
              <h4 className="mb-0.5 flex min-w-0 items-baseline gap-2 text-base font-semibold text-fg">
                <span className="flex-none">Неделя {n}</span>
                <small className="min-w-0 text-note font-normal text-fg-muted">{weekName(w)}</small>
                {currentWeek === n && (
                  <span className="ml-auto flex-none rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-soft-fg">сейчас</span>
                )}
              </h4>
              {w.items.map((it, ii) => {
                const key = markKey(wi, ii)
                const done = marks?.has(key) ?? false
                const body = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-accent-soft-fg">{ITEM_LABEL[it.type] ?? 'Задание'}</span>
                      <b className="text-sm font-semibold leading-snug text-fg">{it.title}</b>
                      {it.note && <span className="text-note text-fg-secondary">{it.note}</span>}
                    </span>
                    {(onToggle || done) && (
                      <span
                        aria-hidden
                        className={`mt-0.5 flex size-5.5 flex-none items-center justify-center rounded-md ${done ? 'bg-success text-success-fg' : 'bg-surface inset-ring-2 inset-ring-fg-faint'}`}
                      >
                        {done && <IconCheck size={14} />}
                      </span>
                    )}
                  </>
                )
                const look = 'flex min-h-11 items-start gap-3 rounded-xl bg-input px-2.75 py-2.25 text-left'
                return onToggle ? (
                  <button
                    key={ii}
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-busy={pending === key || undefined}
                    disabled={pending === key}
                    onClick={() => onToggle(wi, ii, !done)}
                    data-plan-item={key}
                    className={`${look} transition-colors active:bg-row-press`}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={ii} data-plan-item={key} data-done={done || undefined} className={look}>
                    {body}
                    {done && <span className="sr-only">— сделано</span>}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
