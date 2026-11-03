// ============================================================================
// Куски карточки материала (макеты d8-1 `.det`, d17-4): «Выдан» — ученик и
// плашка статуса, текст абзацами, упражнения с ответом (вид по d17: шапка с
// видом упражнения), строка ученика в «Кому выдан».
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

/** Плашка статуса у ученика в «Выдан» (d17-4 `.p7x`): слова без рода — «сдано», а не «сдала». */
function issuedChip(a: MaterialAssignment): { text: string; tone: string } {
  if (a.status === 'reviewed') return { text: 'сдано · проверено', tone: 'bg-success-soft text-success-soft-fg' }
  if (a.status === 'submitted') return { text: 'сдано · ждёт проверки', tone: 'bg-warning-soft text-warning-soft-fg' }
  if ((a.attempts?.length ?? 0) > 0) return { text: 'переназначено', tone: 'bg-input text-fg-secondary' }
  return { text: 'ещё не сдано', tone: 'bg-input text-fg-secondary' }
}

/**
 * «Выдан» (d17-4 `.st17`): строка на ученика — инициалы, имя, справа статус;
 * сдавшие — сверху. Никому — строка, где выдать (d8-1 `.as8`).
 */
export function IssuedList({ assignments, nameOf }: { assignments: MaterialAssignment[]; nameOf: (id: string) => string }) {
  if (assignments.length === 0) {
    return <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm text-fg-secondary">Ещё никому не выдан — выдать можно ниже, в «Кому выдан».</p>
  }
  const rank = (a: MaterialAssignment) => (a.status === 'assigned' ? 1 : 0)
  const rows = [...assignments].sort((a, b) => rank(a) - rank(b) || nameOf(a.student_id).localeCompare(nameOf(b.student_id)))
  return (
    <>
      <DetailHead>Выдан</DetailHead>
      <ul className="flex flex-col rounded-control-sm inset-ring-1 inset-ring-line">
        {rows.map((a) => {
          const chip = issuedChip(a)
          return (
            <li key={a.id} className="flex min-h-12 items-center gap-2.5 border-t border-line px-3 py-1.5 text-sm text-fg first:border-t-0">
              <Avatar name={nameOf(a.student_id)} size={32} />
              <span className="min-w-0 grow truncate">{nameOf(a.student_id)}</span>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-note font-semibold ${chip.tone}`}>{chip.text}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Текст абзацами (d8-1 `.det p`). */
export function MaterialText({ material }: { material: Material }) {
  const paragraphs = material.body.split(/\n\s*\n|\n/).filter((p) => p.trim())
  return (
    <>
      <DetailHead>Текст</DetailHead>
      {paragraphs.map((p, i) => (
        <p key={i} lang={material.lang} className="text-lg leading-relaxed text-fg">
          {p}
        </p>
      ))}
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
