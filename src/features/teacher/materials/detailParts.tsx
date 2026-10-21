// ============================================================================
// Куски карточки материала (макет d8-1 `.det`): «Выдан: Әсел Жұмабаева ·
// вчера, 9:10 · ждёт проверки», текст абзацами, упражнения с ответом, строка
// ученика в «Кому выдан».
// ============================================================================
import { whenDone } from '../../../domains/schedule'
import { correctAnswerText } from '../../../lib/text'
import { plural } from '../../../shared/lib/plural'
import { Avatar } from '../../../shared/ui/Avatar'
import type { GrammarExercise, Material, MaterialAssignment } from '../../../types'

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
      {material.exercises.map((ex, i) => (
        <ExerciseRow key={i} n={i + 1} ex={ex} lang={material.lang} />
      ))}
    </>
  )
}

/** Упражнение с ответом (d8-1, d8-4 `.ex8`): «1 Why did Dana…? Ответ: Her flight had a delay.» */
export function ExerciseRow({ n, ex, lang }: { n: number; ex: GrammarExercise; lang: string }) {
  return (
    <div className="flex gap-2.5 rounded-control-sm bg-input px-3 py-2.5 text-body leading-normal">
      <span className="flex size-6 flex-none items-center justify-center rounded-lg bg-surface text-xs font-semibold text-fg-secondary">{n}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-fg">{ex.prompt}</span>
        <span className="text-sm font-medium text-success-strong">
          <small className="text-sm font-normal text-fg-muted">Ответ: </small>
          <span lang={lang}>{correctAnswerText(ex)}</span>
        </span>
      </span>
    </div>
  )
}

/** Ученик в «Кому выдан»: имя, что с работой, справа — действия. */
export function StudentRow({ name, assignment, children }: { name: string; assignment?: MaterialAssignment; children: React.ReactNode }) {
  const done = assignment?.teacher_review?.filter((r) => r.ok).length ?? 0
  const line = !assignment
    ? 'не выдан'
    : assignment.status === 'submitted'
      ? `ждёт проверки · авто ${assignment.auto_score}/${assignment.auto_total}`
      : assignment.status === 'reviewed'
        ? `проверено: ${done} из ${assignment.auto_total}`
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
