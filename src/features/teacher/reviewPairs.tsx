// ============================================================================
// «Соедини пары» в проверке работы (макет d18, Ф2.25-1б): балл — за пару,
// значит и отметка учителя — у пары. Верная пара — ✓; неверная — что
// соединил ученик зачёркнуто, под ним «верно: …» и «Засчитать»; засчитанная —
// на мягком акценте. Под парами — «Пары Әсел: 3 верно, 1 неверно» и сколько
// засчитано вручную. Узко (телефон, d18-2) — слово над переводом.
// ============================================================================
import { IconCheck } from '../../shared/ui/icons'
import { plural } from '../../shared/lib/plural'
import type { MatchExercise } from '../../types'

export function PairsReview({
  exercise,
  chosen,
  auto,
  marks,
  who,
  lang,
  onMark,
}: {
  exercise: MatchExercise
  /** Что соединил ученик со словом — по порядку пар. */
  chosen: readonly string[]
  /** Отметки авто-проверки. */
  auto: readonly boolean[]
  /** Отметки проверки (учитель или черновик AI). */
  marks: readonly boolean[]
  who: string
  lang: string
  /** Засчитать пару вручную; нет — проверка уже завершена, только смотреть. */
  onMark?: (pair: number, ok: boolean) => void
}) {
  const ok = auto.filter(Boolean).length
  const bad = exercise.pairs.length - ok
  const manual = exercise.pairs.filter((_, i) => !auto[i] && marks[i]).length
  return (
    <>
      <ul className="@container flex flex-col divide-y divide-line overflow-hidden rounded-control-sm inset-ring inset-ring-line">
        {exercise.pairs.map((p, i) => {
          const right = auto[i]
          const credited = !right && marks[i]
          return (
            <li key={i} className={`flex min-h-13 items-center gap-2.5 py-1.5 pr-2 pl-3.5 text-body ${right ? '' : credited ? 'bg-accent-soft' : 'bg-danger-soft'}`}>
              <span className="flex min-w-0 flex-1 flex-col @md:flex-row @md:items-center @md:gap-2.5">
                <span lang={lang} className="font-semibold text-fg @md:w-32.5 @md:flex-none">
                  {p.left}
                </span>
                <span lang={exercise.format === 'definition' ? lang : undefined} className="flex min-w-0 flex-col leading-snug text-fg">
                  {right ? chosen[i] : <s className="text-fg-secondary decoration-danger">{chosen[i] || '—'}</s>}
                  {!right && <small className="text-note font-semibold text-success-strong">верно: {p.right}</small>}
                </span>
              </span>
              {right ? (
                <span aria-label="верно" className="flex size-6.5 flex-none items-center justify-center rounded-full bg-success-soft text-success-strong">
                  <IconCheck size={14} aria-hidden />
                </span>
              ) : (
                <button
                  type="button"
                  aria-pressed={credited}
                  disabled={!onMark}
                  onClick={() => onMark?.(i, !credited)}
                  className={`flex min-h-11 flex-none items-center gap-1.5 rounded-tile px-3 text-note font-semibold whitespace-nowrap transition-colors duration-(--dur-1) disabled:opacity-100 ${
                    credited ? 'bg-primary text-primary-fg' : 'bg-surface text-fg inset-ring inset-ring-line'
                  }`}
                >
                  <span aria-hidden className={`flex size-4 items-center justify-center rounded-mark ${credited ? 'bg-primary-fg text-primary' : 'inset-ring-2 inset-ring-current'}`}>
                    {credited && <IconCheck size={12} />}
                  </span>
                  {onMark ? 'Засчитать' : credited ? 'Засчитано' : 'Не засчитано'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-fg-secondary">
        Пары {who}:{' '}
        <b className="font-semibold text-fg">
          {ok} верно, {bad} неверно
        </b>
        {manual > 0 ? ` · ${manual} ${plural(manual, 'засчитана', 'засчитаны', 'засчитано')} вручную` : bad > 0 && onMark ? ' · «Засчитать» — у каждой неверной пары' : ''}
      </p>
    </>
  )
}
