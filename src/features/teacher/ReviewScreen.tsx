// ============================================================================
// Проверка сданного задания по материалу (макет d18, Ф2.25-1б; до него —
// d7-2): AI делает первичный разбор, преподаватель по каждому упражнению
// соглашается или ставит свой вердикт с комментарием, у «Соедини пары» —
// отметку у каждой пары, и завершает проверку (статус reviewed). Счёт — в
// баллах: пары — по паре (`lib/assignmentScore`). Слева — текст материала
// свёрнутой строкой и упражнения, справа — итог «6 из 8 баллов» с разбивкой
// и «Завершить проверку»; на телефоне итог — полосой внизу (d18-2). Из
// «Проверки работ» сверху листалка «Работа 2 из 2».
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { whenDone } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import { finishReview, generateAiReview, reassignAssignment, saveAiReview } from '../../lib/materials'
import { exerciseScores, points, workScore } from '../../lib/assignmentScore'
import { shortLabel } from '../../lib/exerciseFormats'
import type { Material, MaterialAssignment, ReviewItem } from '../../types'
import { ScreenTop } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { MainAside } from '../../shared/ui/layouts'
import { AREA } from '../../shared/ui/breakpoints'
import { useContentAtLeast } from '../../shared/lib/screenWidth'
import { Thinking } from '../../shared/ui/Thinking'
import { AiBanner, MaterialText } from './reviewBits'
import { ReviewExercise } from './ReviewExercise'
import { ReviewBar, ReviewSummary } from './reviewTotals'
import { useReviewDraft } from './useReviewDraft'
import { ErrorText } from '../../shared/ui/ErrorText'

export function ReviewScreen({
  material,
  assignment,
  studentName,
  onDone,
  onBack,
  backLabel = 'Назад',
  pager,
  next,
}: {
  material: Material
  assignment: MaterialAssignment
  studentName: string
  onDone: () => void
  onBack: () => void
  /** Куда «назад»: «Задания» из хаба, «Материал» из библиотеки. */
  backLabel?: string
  /** Листалка «Работа 2 из 2 ‹ ›» — из «Проверки работ». */
  pager?: ReactNode
  /** Что откроется после «Завершить»: «Айгерим Нурланова · IELTS Task 2». */
  next?: string | null
}) {
  const alreadyReviewed = assignment.status === 'reviewed'
  const [base, setReview] = useState<ReviewItem[] | null>(alreadyReviewed ? assignment.teacher_review : assignment.ai_review)
  // правки учителя переживают перезагрузку до сохранения (Ф1.14)
  const { review, setItem, draft } = useReviewDraft(assignment.id, base)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { ask, dialog } = useConfirm()
  // итог справа — когда рядом есть место, иначе полосой внизу (d18-2)
  const split = useContentAtLeast(AREA.homeSplit)

  // Первичный AI-разбор (один раз). requestedRef защищает от двойного вызова
  // Gemini в StrictMode/dev; runAiReview можно вызвать повторно как ретрай.
  const requestedRef = useRef(false)
  const runAiReview = () => {
    if (aiBusy) return
    setAiBusy(true)
    setError(null)
    generateAiReview(material, assignment)
      .then((r) => {
        setReview(r)
        void saveAiReview(assignment.id, r) // кэшируем, чтобы не генерировать повторно
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка AI-разбора'))
      .finally(() => setAiBusy(false))
  }
  useEffect(() => {
    if (review !== null || requestedRef.current) return
    requestedRef.current = true
    runAiReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exercises = material.exercises
  const answers = assignment.answers ?? []
  // счёт — в баллах (у пар — по паре), одной функцией с экраном ученика
  const total = workScore(exercises, answers, review)
  const auto = workScore(exercises, answers, null).got
  const proposed = workScore(exercises, answers, base)
  const who = firstName(studentName)
  const title = material.title ?? material.topic

  const finish = async () => {
    if (!review) return
    setSaving(true)
    setError(null)
    try {
      await finishReview(assignment.id, review)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setSaving(false)
    }
  }

  const reassign = async () => {
    const note = await ask({
      title: 'Переназначить материал?',
      body: `${who} сделает задание ещё раз; этот результат останется в истории.`,
      field: { label: 'На что обратить внимание', placeholder: 'Необязательно' },
      action: 'Переназначить',
      danger: false,
    })
    if (note === null) return
    setSaving(true)
    setError(null)
    try {
      await reassignAssignment(assignment, note)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить')
      setSaving(false)
    }
  }

  const attempts = assignment.attempts ?? []
  const main = (
    <div className="flex flex-col gap-3.5">
      <MaterialText title={title} body={material.body} lang={material.lang} />
      {draft.restored && <DraftRestored onClear={draft.clear} />}
      {aiBusy && (
        <p className="rounded-control bg-accent-soft px-4 py-3 text-body text-accent-soft-fg">
          <Thinking label="AI разбирает работу" className="text-accent-soft-fg" />
        </p>
      )}
      {error && (
        <Card tone="danger">
          <ErrorText>{error}</ErrorText>
          {!review && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={runAiReview}>
              Повторить разбор
            </Button>
          )}
        </Card>
      )}
      {review && (
        <AiBanner>
          {alreadyReviewed
            ? `Проверено: ${points(total.got)} из ${total.of}`
            : `AI предлагает засчитать ${points(proposed.got)} из ${proposed.of} — проверь спорные`}
        </AiBanner>
      )}
      {review &&
        exercises.map((ex, i) => {
          const item = review.find((r) => r.index === i)
          if (!item) return null
          return (
            <ReviewExercise
              key={i}
              ex={ex}
              index={i}
              answer={answers.find((a) => a.index === i)}
              item={item}
              who={who}
              lang={material.lang}
              level={material.level}
              onItem={alreadyReviewed ? undefined : (patch) => setItem(i, patch)}
            />
          )
        })}
      {attempts.length > 0 && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Прошлые попытки</p>
          {attempts.map((at, i) => {
            const tOk = workScore(exercises, at.answers, at.teacher_review).got
            return (
              <p key={i} className="text-sm text-fg-muted">
                {i + 1}-я: авто {at.auto_score}/{at.auto_total}
                {at.teacher_review ? ` · учитель ${tOk}/${at.auto_total}` : ''}
                {at.submitted_at ? ` · ${whenDone(at.submitted_at)}` : ''}
              </p>
            )
          })}
        </Card>
      )}
    </div>
  )
  const action = alreadyReviewed ? (
    <Button variant="secondary" className="w-full" onClick={reassign} loading={saving}>
      Переназначить
    </Button>
  ) : (
    <Button className="w-full" onClick={finish} loading={saving}>
      Завершить проверку
    </Button>
  )
  const rows = exerciseScores(exercises, answers, review).map((score, i) => ({ label: exercises[i] ? shortLabel(exercises[i]) : '', score }))
  const aside =
    review &&
    (split ? (
      <ReviewSummary total={total} auto={auto} rows={rows} action={action} next={alreadyReviewed ? null : next} />
    ) : (
      <ReviewBar total={total} auto={auto} action={action} />
    ))

  return (
    <div className="flex flex-col gap-4">
      <ScreenTop
        back={{ label: backLabel, onClick: onBack }}
        // на телефоне — только имя, как в d18-2: полное в две строки теснило шапку
        title={`${split ? studentName : who} · «${title}»`}
        subtitle={['задание по материалу', whenDone(assignment.submitted_at)].filter(Boolean).join(' · ')}
        trailing={pager}
      />
      <MainAside size="narrow" label="Итог проверки" main={main} aside={aside} />
      {dialog}
    </div>
  )
}
