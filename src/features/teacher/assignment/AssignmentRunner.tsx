// ============================================================================
// Прохождение задания учеником: текст → упражнения → сдача (?a=<id>&stage=).
// Ответы — черновиком (useAnswerDraft): переживают выход в список,
// перезагрузку и сбой связи при сдаче (стираются после неё). Учитель
// поправил задание (Ф2.25-3б) — черновик старой версии сброшен с подписью
// «Учитель обновил задание», сдача старой версии — отказ сервера и новая
// версия. Балл считает сервер (submit_material); счёт на экране — в
// баллах (`lib/assignmentScore`: пары — по паре), тот же, что пришлёт сервер.
// Упражнения — по макету u5: на время упражнений меню каркаса спрятано
// (режим раунда, Esc — к заданиям), на телефоне своя шапка, на компьютере —
// рамка раунда d5 с ходом «Упражнения» и клавишами.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BackHeader } from '../../../shared/ui/BackButton'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { RoundResult } from '../../../components/RoundResult'
import { ExerciseView } from '../../../components/exercises'
import { correctAnswerText } from '../../../lib/text'
import type { ReviewItem } from '../../../components/RoundReview'
import { logActivity } from '../../../lib/activity'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { RoundFrame, type RoundStep } from '../../../shared/ui/RoundFrame'
import { useRoundMode } from '../../../shared/ui/roundKeys'
import { plural } from '../../../shared/lib/plural'
import { useAnswerDraft } from '../useAnswerDraft'
import { submitAssignment } from '../../../lib/materialAssignments'
import { answerPoints, exercisePoints, points, workScore } from '../../../lib/assignmentScore'
import { useScrollTop } from '../../../lib/useScrollTop'
import { TappableBody, type Row } from './TappableBody'
import { PhoneTop, ReadAgain, ScoreCount, keysFor } from './runnerBits'
import type { AssignmentAnswer } from '../../../types'
import { AppError } from '../../../shared/api/errors'

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
  onOutdated,
}: {
  row: Row
  stage: Stage
  onStage: (s: Stage) => void
  onDone: () => void
  onBack: () => void
  /** Учитель поправил задание, пока ученик решал: перечитать и начать с текста. */
  onOutdated: () => void
}) {
  const m = row.material
  useScrollTop(stage)
  // Ответы переживают и выход в список (раньше любой выход обнулял работу —
  // главная жалоба ревью навигации), и перезагрузку (Ф1.14): useAnswerDraft.
  const draft = useAnswerDraft(row.id, m.exercises_version)
  const { index, setIndex, answerMap, setAnswerMap } = draft
  // учитель обновил задание — заново с текста: он мог поправить и его (решение владельца 04.11)
  useEffect(() => {
    if (draft.updated && stage !== 'read') onStage('read')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
  // счёт — в баллах, как у сервера: «Соедини пары» — по паре
  const score = workScore(m.exercises, answers)
  const scoreBefore = score.got - (current && answerMap[index] ? answerPoints(current, answerMap[index]) : 0)

  // ok приходит из onAnswered, пары — из onPairs, given — из onGiven; собираем
  // в одну запись по index. Именно ref, а не состояние: значение живёт между
  // колбэками одного упражнения и не должно вызывать перерисовку
  const pendingRef = useRef<{ ok: boolean; pairs?: string[] }>({ ok: false })

  const onAnswered = (ok: boolean) => {
    pendingRef.current = { ok }
  }
  const onPairs = (pairs: string[]) => {
    pendingRef.current.pairs = pairs
  }
  const onGiven = (given: string) => {
    const { ok, pairs } = pendingRef.current
    setAnswerMap((m) => ({ ...m, [index]: { index, given, auto_ok: ok, ...(pairs ? { pairs } : {}) } }))
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
    if (alreadyDone) {
      draft.forget()
      return
    }
    setSaving(true)
    try {
      await submitAssignment(row.id, answers, score.got, score.of, m.exercises_version)
      // черновик — только после сдачи: моргнула связь — ответы остаются на устройстве
      draft.forget()
      void logActivity('assignment')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось отправить работу')
      // учитель поправил задание, пока ученик решал: новая версия, черновик старой сбросится с подписью
      if (e instanceof AppError && e.code === 'RECALL_MATERIAL_CHANGED') onOutdated()
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
        correct={score.got}
        total={score.of}
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

        {draft.updated && (
          <Card tone="warning">
            <p className="text-sm text-warning-soft-fg" data-teacher-updated>
              Учитель обновил задание — прежние ответы сброшены, пройди его заново.
            </p>
          </Card>
        )}

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
            Работа уже сдана ({row.auto_score} из {row.auto_total} {plural(row.auto_total ?? 0, 'балла', 'баллов', 'баллов')}) — повторное
            прохождение не отправляется.
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
    <ExerciseStage
      row={row}
      index={index}
      answers={answerMap}
      score={score.got}
      scoreBefore={scoreBefore}
      restored={draft.restored ? draft.clear : null}
      updated={draft.updated}
      onRead={() => onStage('read')}
      onBack={onBack}
    >
      <ExerciseView
        key={index}
        bare
        lang={m.lang}
        score={scoreBefore}
        exercise={current}
        onAnswered={onAnswered}
        onPairs={onPairs}
        onGiven={onGiven}
        onNext={next}
        isLast={index + 1 >= total}
      />
    </ExerciseStage>
  )
}

/**
 * Упражнения по u5: режим раунда (меню спрятано, Esc — к заданиям); на
 * телефоне — шапка «‹ Название», «перечитать текст» и счёт; на компьютере —
 * рамка d5: ход «Упражнения» (у пар — «3/4»), «6 баллов», клавиши.
 * «‹» ведёт в СПИСОК заданий, а не на шаг вверх: «перечитать текст» рядом и
 * так есть, а лишний шаг в истории возвращал бы свайпом обратно в упражнения.
 */
function ExerciseStage({
  row,
  index,
  answers,
  score,
  scoreBefore,
  restored,
  updated,
  onRead,
  onBack,
  children,
}: {
  row: Row
  index: number
  answers: Record<number, AssignmentAnswer>
  score: number
  scoreBefore: number
  /** Черновик восстановлен — «Очистить»; null — нет. */
  restored: (() => void) | null
  /** Учитель обновил задание — ответы начаты заново. */
  updated: boolean
  onRead: () => void
  onBack: () => void
  children: ReactNode
}) {
  const m = row.material
  const total = m.exercises.length
  const current = m.exercises[index]
  useRoundMode(true, onBack)
  // ход слева — упражнения позади: верно / нет, у пар — сколько из скольких
  const steps: RoundStep[] = m.exercises
    .slice(0, index)
    .map((ex, i) => (ex.type === 'match' ? { got: answerPoints(ex, answers[i]), of: exercisePoints(ex) } : !!answers[i]?.auto_ok))
  // «+3» — только что проверенные пары (u5-2)
  const plus = current?.type === 'match' && answers[index] ? score - scoreBefore : 0
  const count = <ScoreCount at={index + 1} total={total} score={score} plus={plus} />
  const title = m.title ?? m.topic

  return (
    <RoundFrame
      title={title}
      at={index + 1}
      total={total}
      results={steps}
      keys={current ? keysFor(current) : undefined}
      onExit={onBack}
      back={title}
      count={count}
      headerEnd={<ReadAgain onClick={onRead} />}
      trackTitle="Упражнения"
      trackNote={points(score)}
      dense
      narrowHeader={<PhoneTop title={title} lang={m.lang} onBack={onBack} onRead={onRead} count={count} done={index} total={total} />}
    >
      {updated ? (
        <p className="text-xs text-fg-muted" data-teacher-updated>
          Учитель обновил задание — ответы начаты заново
        </p>
      ) : (
        restored && <DraftRestored onClear={restored} />
      )}
      {children}
    </RoundFrame>
  )
}
