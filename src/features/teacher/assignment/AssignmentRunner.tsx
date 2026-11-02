// ============================================================================
// Прохождение задания учеником: текст → упражнения → сдача (?a=<id>&stage=).
// Ответы — черновиком (useAnswerDraft): переживают выход в список и
// перезагрузку. Балл считает сервер (submit_material); счёт на экране — тот
// же, что пришлёт сервер.
// ============================================================================
import { useRef, useState } from 'react'
import { BackHeader } from '../../../shared/ui/BackButton'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { RoundResult } from '../../../components/RoundResult'
import { ExerciseView } from '../../../components/exercises'
import { correctAnswerText } from '../../../lib/text'
import type { ReviewItem } from '../../../components/RoundReview'
import { logActivity } from '../../../lib/activity'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { useAnswerDraft } from '../useAnswerDraft'
import { submitAssignment } from '../../../lib/materials'
import { useScrollTop } from '../../../lib/useScrollTop'
import { TappableBody, type Row } from './TappableBody'

/**
 * Стадия прохождения задания — живёт в адресе (?stage=).
 * Итога раунда здесь нет намеренно: результат — это ход раунда, а не место.
 * После F5 он показал бы честный «0 из 13» вместо набранного, поэтому остаётся
 * локальным состоянием раннера (правило из shared/lib/useUrlState.ts).
 */
export type Stage = 'read' | 'exercises' | 'review'
export const STAGES: string[] = ['read', 'exercises', 'review']

export function AssignmentRunner({
  row,
  stage,
  onStage,
  onDone,
  onBack,
}: {
  row: Row
  stage: Stage
  onStage: (s: Stage) => void
  onDone: () => void
  onBack: () => void
}) {
  const m = row.material
  useScrollTop(stage)
  // Ответы переживают и выход в список (раньше любой выход обнулял работу —
  // главная жалоба ревью навигации), и перезагрузку (Ф1.14): useAnswerDraft.
  const draft = useAnswerDraft(row.id)
  const { index, setIndex, answerMap, setAnswerMap } = draft
  // Итог раунда в адрес не пишем (см. Stage), но и залипать на нём нельзя:
  // системная кнопка «назад» меняет стадию — значит, итог надо снять.
  // (сброс — при отрисовке, а не эффектом: так React не рисует кадр со старым итогом)
  const [finished, setFinished] = useState(false)
  const [shownStage, setShownStage] = useState(stage)
  if (shownStage !== stage) {
    setShownStage(stage)
    setFinished(false)
  }
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const alreadyDone = row.status !== 'assigned'
  const total = m.exercises.length
  const current = m.exercises[index]

  const answers = Object.values(answerMap)
  const correct = answers.filter((a) => a.auto_ok).length

  // ok приходит из onAnswered, given — из onGiven; собираем в одну запись по index
  // именно ref, а не состояние: значение живёт между двумя колбэками одного
  // упражнения (onAnswered → onGiven) и не должно вызывать перерисовку
  const pendingRef = useRef<{ ok: boolean }>({ ok: false })

  const onAnswered = (ok: boolean) => {
    pendingRef.current.ok = ok
  }
  const onGiven = (given: string) => {
    setAnswerMap((m) => ({ ...m, [index]: { index, given, auto_ok: pendingRef.current.ok } }))
  }

  const next = () => {
    if (index + 1 >= total) {
      void finish()
    } else {
      setIndex((i) => i + 1)
    }
  }

  const finish = async () => {
    setFinished(true)
    draft.forget()
    if (alreadyDone) return
    setSaving(true)
    try {
      await submitAssignment(row.id, answers, correct, total)
      void logActivity('assignment')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось отправить работу')
    } finally {
      setSaving(false)
    }
  }

  // Разбор ошибок для итогового экрана. Собираем из УЖЕ имеющихся данных
  // (ответы + сами упражнения) — отдельный сборщик тут не нужен.
  //
  // Зачем: в практике после раунда есть «Почему?» — короткое объяснение от AI,
  // а в заданиях от преподавателя не было ничего. Ученик видел «неверно» и
  // правильный ответ, но не узнавал, чем плох его собственный, — то есть
  // ошибка ничему не учила. Механика была написана и просто не подключена.
  const reviewItems: ReviewItem[] = m.exercises.map((ex, i) => {
    const a = answerMap[i]
    return {
      prompt: ex.prompt,
      given: a?.given ?? '(нет ответа)',
      correct: correctAnswerText(ex),
      ok: a?.auto_ok ?? false,
    }
  })

  if (finished) {
    return (
      <RoundResult
        correct={correct}
        total={total}
        review={reviewItems}
        lang={m.lang}
        note={
          alreadyDone
            ? undefined
            : saving
              ? 'Отправляю работу преподавателю…'
              : saveError
                ? saveError
                : 'Работа отправлена преподавателю на проверку ✓'
        }
        restartLabel="К заданиям"
        onRestart={onDone}
      />
    )
  }

  if (stage === 'read') {
    return (
      <div className="flex flex-col gap-3">
        <BackHeader onBack={onBack} title={m.title ?? m.topic} label="К заданиям" />

        {row.note && row.status === 'assigned' && (
          <Card tone="warning">
            <p className="text-sm text-warning-soft-fg">
              💬 Комментарий преподавателя: {row.note}
            </p>
          </Card>
        )}

        <Card>
          <p className="text-xs text-fg-muted">
            {m.level} · {m.format} · прочитай внимательно — упражнения по тексту.
            Нажимай на незнакомые слова, чтобы добавить их в колоду.
          </p>
          <TappableBody body={m.body} lang={m.lang} />
        </Card>
        <Button onClick={() => onStage('exercises')}>
          {alreadyDone ? 'Пройти ещё раз (без пересдачи) →' : `К упражнениям (${total}) →`}
        </Button>
        {alreadyDone && (
          <p className="text-center text-xs text-fg-muted">
            Работа уже сдана ({row.auto_score}/{row.auto_total}) — повторное прохождение не отправляется.
          </p>
        )}
      </div>
    )
  }

  // index всегда в границах [0, total-1] пока stage === 'exercises' (next()
  // увеличивает index только пока index + 1 < total, иначе завершает раунд) —
  // подстраховка для noUncheckedIndexedAccess.
  if (!current) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Заголовок с возвратом есть и на упражнениях: раньше здесь не было ни
          того, ни другого — ученик не видел, какое задание выполняет, и выйти
          мог только системным «назад». Каретка ведёт в СПИСОК заданий, а не на
          шаг вверх: «перечитать текст» рядом и так есть, а лишний push в
          историю возвращал бы свайпом обратно в упражнения. */}
      <BackHeader onBack={onBack} title={m.title ?? m.topic} label="К заданиям" />
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <button onClick={() => onStage('read')} className="font-medium text-accent-strong hover:underline">
          ↑ перечитать текст
        </button>
        <span>
          {index + 1} / {total} · верно: {correct}
        </span>
      </div>
      {draft.restored && <DraftRestored onClear={draft.clear} />}
      <ExerciseView
        key={index}
        exercise={current}
        onAnswered={onAnswered}
        onGiven={onGiven}
        onNext={next}
        isLast={index + 1 >= total}
      />
    </div>
  )
}
