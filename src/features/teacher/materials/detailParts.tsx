// ============================================================================
// Куски карточки материала (макет d8-1 `.det`): «Выдан: Әсел Жұмабаева ·
// вчера, 9:10 · ждёт проверки», текст абзацами, упражнения с ответом (вид по
// d17: шапка с видом упражнения), строка ученика в «Кому выдан».
// ============================================================================
import { whenDone } from '../../../domains/schedule'
import { correctAnswerText } from '../../../lib/text'
import { plural } from '../../../shared/lib/plural'
import { Avatar } from '../../../shared/ui/Avatar'
import { points, workScore } from '../../../lib/assignmentScore'
import { formatLabel } from '../../../lib/exerciseFormats'
import type { Material, MaterialAssignment, MaterialExercise } from '../../../types'

/** Подзаголовок карточки (d8-1 `.sh8`): «Текст», «Упражнения · 2». */
export function DetailHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-1.5 text-note font-semibold text-fg-muted">{children}</h3>
}

const STATUS: Record<MaterialAssignment['status'], string> = {
  assigned: 'ещё не выполнено',
  submitted: 'ждёт проверки',
  reviewed: 'проверено',
}

/** «Выдан: <b>Әсел Жұмабаева</b> · вчера, 9:10 · ждёт проверки»; нескольким — имена и счёт по статусам. */
export function IssuedLine({ assignments, nameOf }: { assignments: MaterialAssignment[]; nameOf: (id: string) => string }) {
  const box = 'rounded-control-sm bg-input px-3 py-2.5 text-sm text-fg-secondary'
  if (assignments.length === 0) return <p className={box}>Ещё никому не выдан — выдать можно ниже, в «Кому выдан».</p>
  const [first] = assignments
  if (assignments.length === 1 && first) {
    return (
      <p className={box}>
        Выдан: <b className="font-semibold text-fg">{nameOf(first.student_id)}</b> ·{' '}
        {[whenDone(first.created_at), STATUS[first.status]].filter(Boolean).join(' · ')}
      </p>
    )
  }
  const names = assignments.slice(0, 2).map((a) => nameOf(a.student_id))
  const rest = assignments.length - names.length
  const counts = (['submitted', 'reviewed', 'assigned'] as const)
    .map((st) => [st, assignments.filter((a) => a.status === st).length] as const)
    .filter(([, n]) => n > 0)
    .map(([st, n]) => `${n} ${st === 'assigned' ? 'не выполнено' : STATUS[st]}`)
  return (
    <p className={box}>
      Выдан: <b className="font-semibold text-fg">{names.join(', ')}</b>
      {rest > 0 && ` и ещё ${rest}`} · {counts.join(' · ')}
    </p>
  )
}

/** Текст абзацами и упражнения с ответом (d8-1 `.det p`, `.ex8`). */
export function MaterialBody({ material }: { material: Material }) {
  const paragraphs = material.body.split(/\n\s*\n|\n/).filter((p) => p.trim())
  const n = material.exercises.length
  return (
    <>
      <DetailHead>Текст</DetailHead>
      {paragraphs.map((p, i) => (
        <p key={i} lang={material.lang} className="text-lg leading-relaxed text-fg">
          {p}
        </p>
      ))}
      <DetailHead>
        {plural(n, 'Упражнение', 'Упражнения', 'Упражнений')} · {n}
      </DetailHead>
      <div className="@container flex flex-col gap-2.5">
        {material.exercises.map((ex, i) => (
          <ExerciseRow key={i} n={i + 1} ex={ex} lang={material.lang} />
        ))}
      </div>
    </>
  )
}

/** «Соедини слово и перевод · 5 пар», «True / False» — вид упражнения в его шапке (d17). */
export function rowLabel(ex: MaterialExercise): string {
  return ex.type === 'match' ? `${formatLabel(ex)} · ${ex.pairs.length} ${plural(ex.pairs.length, 'пара', 'пары', 'пар')}` : formatLabel(ex)
}

/** Шапка упражнения (d17 `.eh17`): номер и вид; на правке номер — акцентом. */
export function ExerciseHead({ n, label, editing = false }: { n: number; label: string; editing?: boolean }) {
  return (
    <span className="flex min-h-8 items-center gap-2">
      <span className={`flex size-6 flex-none items-center justify-center rounded-tag text-xs font-semibold ${editing ? 'bg-accent-soft text-accent-soft-fg' : 'bg-surface text-fg-secondary'}`}>{n}</span>
      <span className="text-xs font-semibold text-fg-muted">{label}</span>
    </span>
  )
}

/**
 * Упражнение с ответом (d17 `.ec17`; d8-1, d8-4): шапка — номер, вид и
 * действия справа; ниже вопрос и «Ответ: …» цветом ответа, у пар — слово и
 * перевод двумя колонками. Узко (телефон) — действия строкой под
 * упражнением, цели 44 (заметка d17 «Телефон»): шапке их не уместить.
 */
export function ExerciseRow({ n, ex, lang, actions }: { n: number; ex: MaterialExercise; lang: string; actions?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-control bg-input py-3 pl-3.5 pr-3 @lg:grid-cols-[minmax(0,1fr)_auto]" data-exercise={n}>
      <ExerciseHead n={n} label={rowLabel(ex)} />
      {actions && <span className="order-last -mb-1.5 -ml-2 flex flex-wrap gap-0.5 @lg:order-none @lg:col-start-2 @lg:row-start-1 @lg:mb-0 @lg:ml-0">{actions}</span>}
      {ex.type === 'match' ? (
        <span className="grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 text-sm @lg:col-span-2">
          {ex.pairs.map((p, i) => (
            <span key={i} className="contents">
              <span lang={lang} className="text-fg">
                {p.left}
              </span>
              <span lang={ex.format === 'definition' ? lang : undefined} className="font-medium text-success-strong">
                {p.right}
              </span>
            </span>
          ))}
        </span>
      ) : (
        <span className="flex flex-col gap-2 @lg:col-span-2">
          <span lang={lang} className="text-body leading-snug text-fg">
            {ex.prompt}
          </span>
          <span className="text-sm font-medium text-success-strong">
            <small className="text-sm font-normal text-fg-muted">Ответ: </small>
            <span lang={lang}>{correctAnswerText(ex)}</span>
          </span>
        </span>
      )}
    </div>
  )
}

/** Ученик в «Кому выдан»: имя, что с работой, справа — действия. */
export function StudentRow({
  name,
  assignment,
  exercises,
  children,
}: {
  name: string
  assignment?: MaterialAssignment
  exercises: MaterialExercise[]
  children: React.ReactNode
}) {
  // счёт в баллах (у пар — по паре), одной функцией с проверкой и экраном ученика
  const done = assignment ? workScore(exercises, assignment.answers, assignment.teacher_review) : null
  const line = !assignment
    ? 'не выдан'
    : assignment.status === 'submitted'
      ? `ждёт проверки · авто ${assignment.auto_score}/${assignment.auto_total}`
      : assignment.status === 'reviewed'
        ? `проверено: ${done?.got} из ${points(done?.of ?? 0)}`
        : `выдан ${whenDone(assignment.created_at)} · ещё не выполнено`
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-2.5 first:border-t-0">
      <Avatar name={name} size={32} />
      {/* не уже 10rem: кнопкам не хватает места — они уходят строкой ниже, а не сжимают имя */}
      <span className="flex min-w-0 flex-1 basis-40 flex-col leading-snug">
        <span className="truncate text-body font-medium text-fg">{name}</span>
        <span className="text-note text-fg-muted">{line}</span>
      </span>
      <span className="ml-auto flex flex-none gap-1.5">{children}</span>
    </div>
  )
}
