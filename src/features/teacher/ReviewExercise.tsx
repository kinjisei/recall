// ============================================================================
// Одно упражнение в проверке работы по материалу (макет d18, Ф2.25-1б):
// шапка — номер, вид («True / False · текст A2», «Соедини слово и
// перевод · балл за пару») и счёт «1 из 1 / 3 из 4». Верное и по
// авто-проверке, и по вердикту — одной строкой «✓ ответ · ответ Әсел»;
// спорное или неверное — ответ и правильный, «Правильно / Ошибка»,
// комментарий AI, который можно править. У пар — отметка у каждой пары.
// ============================================================================
import { autoVerdict, exercisePoints, verdictPoints } from '../../lib/assignmentScore'
import { formatLabel } from '../../lib/exerciseFormats'
import { correctAnswerText } from '../../lib/text'
import type { AssignmentAnswer, MaterialExercise, ReviewItem } from '../../types'
import { AnswerBox, AnswerLine, ExerciseCard, PointsPill, Verdict } from './reviewBits'
import { PairsReview } from './reviewPairs'

export function ReviewExercise({
  ex,
  index,
  answer,
  item,
  who,
  lang,
  level,
  onItem,
}: {
  ex: MaterialExercise
  index: number
  answer: AssignmentAnswer | undefined
  item: ReviewItem
  who: string
  lang: string
  level: string
  /** Правка вердикта; нет — проверка уже завершена, только смотреть. */
  onItem?: (patch: Partial<ReviewItem>) => void
}) {
  const auto = autoVerdict(ex, answer, index)
  const pill = <PointsPill got={verdictPoints(ex, item)} of={exercisePoints(ex)} />
  const tail = ex.type === 'mcq' && ex.format === 'tfng' ? ` · текст ${level}` : ex.type === 'match' ? ' · балл за пару' : ''
  const label = formatLabel(ex) + tail

  if (ex.type === 'match') {
    const marks = item.pairs ?? auto.pairs ?? []
    return (
      <ExerciseCard n={index + 1} label={label} pill={pill} lang={lang}>
        <PairsReview
          exercise={ex}
          chosen={answer?.pairs ?? []}
          auto={auto.pairs ?? []}
          marks={marks}
          who={who}
          lang={lang}
          onMark={
            onItem &&
            ((pair, ok) => {
              const pairs = ex.pairs.map((_, i) => (i === pair ? ok : marks[i] === true))
              onItem({ pairs, ok: pairs.every(Boolean) })
            })
          }
        />
      </ExerciseCard>
    )
  }

  const given = answer?.given ?? '(нет ответа)'
  // верно и по авто-проверке, и по вердикту — спорить не о чем: одна строка
  const settled = item.ok && auto.ok
  return (
    <ExerciseCard n={index + 1} label={label} pill={pill} prompt={ex.prompt} lang={lang}>
      {settled ? (
        <AnswerLine who={who} given={given} lang={lang} />
      ) : (
        <AnswerBox who={who} given={given} correct={correctAnswerText(ex)} ok={item.ok} lang={lang} />
      )}
      {!settled &&
        (onItem ? (
          <>
            <Verdict ok={item.ok} onChange={(ok) => onItem({ ok })} />
            <label className="flex flex-col gap-1">
              <small className="text-xs text-fg-muted">Комментарий · AI, можно править</small>
              <textarea
                className="field-sizing-content min-h-11 w-full resize-none rounded-control-sm bg-surface px-3 py-2.5 text-sm leading-relaxed text-fg inset-ring-1 inset-ring-line outline-none placeholder:text-fg-muted focus:inset-ring-2 focus:inset-ring-focus"
                placeholder="Комментарий для ученика: что не так и как правильно…"
                value={item.comment}
                onChange={(e) => onItem({ comment: e.target.value })}
              />
            </label>
          </>
        ) : (
          item.comment && <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm text-fg-secondary">{item.comment}</p>
        ))}
    </ExerciseCard>
  )
}
