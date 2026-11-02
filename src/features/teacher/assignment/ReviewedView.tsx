// ============================================================================
// Разбор проверенной работы у ученика: вердикты и комментарии преподавателя.
// Счёт — в баллах (у пар — по паре, `lib/assignmentScore`), у «Соедини
// пары» — пары с отметкой учителя (та же таблица, что после «Проверить»).
// ============================================================================
import { useState } from 'react'
import { BackHeader } from '../../../shared/ui/BackButton'
import { Reveal } from '../../../shared/ui/Reveal'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { ScoreGlyph } from '../../../components/RoundResult'
import { PairsChecked } from '../../../components/MatchExercise'
import { correctAnswerText, matchVerdicts } from '../../../lib/text'
import { points, workScore } from '../../../lib/assignmentScore'
import { TappableBody, type Row } from './TappableBody'

export function ReviewedView({
  row,
  onBack,
  onRetry,
}: {
  row: Row
  onBack: () => void
  onRetry: () => void
}) {
  const m = row.material
  const review = row.teacher_review ?? []
  const answers = row.answers ?? []
  const score = workScore(m.exercises, answers, review)
  const percent = score.of ? Math.round((score.got / score.of) * 100) : 0
  const [showBody, setShowBody] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title={m.title ?? m.topic} label="К заданиям" />

      <Card className="flex flex-col items-center text-center">
        <ScoreGlyph percent={percent} />
        <p className="mt-2 text-lg font-bold">
          Проверено преподавателем: {points(score.got)} из {score.of}
        </p>
        <p className="mt-1 text-sm text-fg-muted">Разбор по каждому упражнению ниже.</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setShowBody((s) => !s)}>
          {showBody ? 'Скрыть текст' : 'Перечитать текст'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Пройти упражнения заново
        </Button>
      </div>
      <Reveal open={showBody}>
        <Card>
          {/* тот же тап по словам, что и в «Учёбе»: разобранный текст —
              лучший источник слов для колоды */}
          <p className="text-xs text-fg-muted">
            Нажми на незнакомое слово, чтобы посмотреть перевод и добавить в колоду.
          </p>
          <TappableBody body={m.body} lang={m.lang} />
        </Card>
      </Reveal>

      {m.exercises.map((ex, i) => {
        const item = review.find((r) => r.index === i)
        const answer = answers.find((a) => a.index === i)
        const given = answer?.given ?? '(нет ответа)'
        // верный ответ — одним правилом на все виды (у «собери» раньше было пусто)
        const correct = correctAnswerText(ex)
        const ok = item?.ok ?? false
        return (
          <Card key={i} className="flex flex-col gap-1.5">
            <p className="text-xs text-fg-muted">{i + 1}</p>
            <p className="text-sm font-medium">{ex.prompt}</p>
            {ex.type === 'match' ? (
              <PairsChecked
                exercise={ex}
                chosen={answer?.pairs ?? []}
                verdicts={item?.pairs ?? matchVerdicts(ex, answer?.pairs)}
                lang={m.lang}
              />
            ) : (
              <p className="text-sm">
                Твой ответ:{' '}
                <span className={ok ? 'font-semibold text-success-strong' : 'font-semibold text-danger-strong'}>
                  {given} {ok ? '✓' : '✗'}
                </span>
                {!ok && correct && <span className="text-fg-muted"> · правильно: {correct}</span>}
              </p>
            )}
            {item?.comment && (
              <p className="rounded-tile bg-tint/[0.06] px-3 py-2 text-sm text-fg-secondary">
                💬 {item.comment}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
