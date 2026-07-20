// ============================================================================
// «Задания» ученицы: назначенные преподавателем материалы — текст + упражнения.
// Прохождение: чтение → упражнения (общий движок) → сдача (авто-балл, статус
// submitted). Проверка преподавателем — следующая фаза фичи.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ExerciseView } from '../../components/exercises'
import { TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
import { logActivity } from '../../lib/activity'
import { useAsyncData } from '../../lib/useAsyncData'
import { LoadError } from '../../components/LoadError'
import { addCard } from '../../lib/cards'
import { lookup } from '../../lib/dictionary'
import { lookupSpanish } from '../../lib/spanishDict'
import { speak } from '../../lib/speech'
import {
  getMyAssignments,
  submitAssignment,
} from '../../lib/materials'
import type {
  AppLang,
  AssignmentAnswer,
  Material,
  MaterialAssignment,
} from '../../types'

type Row = MaterialAssignment & { material: Material }

export function AssignmentsPage() {
  const [active, setActive] = useState<Row | null>(null)
  // повторное прохождение проверенной работы — тренировка без пересдачи
  const [retry, setRetry] = useState(false)

  // при сбое показываем ошибку, а не «Заданий пока нет»: раньше ученица
  // думала, что работы нет, и не повторяла попытку
  const {
    data: rows,
    error,
    loading,
    reload,
  } = useAsyncData<Row[]>(() => getMyAssignments(), [], 'Не удалось загрузить задания')

  const close = () => {
    setActive(null)
    setRetry(false)
  }

  if (active) {
    // проверенная работа — сначала разбор от преподавателя;
    // «Пройти заново» переключает на упражнения (без пересдачи)
    if (active.status === 'reviewed' && !retry) {
      return <ReviewedView row={active} onBack={close} onRetry={() => setRetry(true)} />
    }
    return (
      <AssignmentRunner
        row={active}
        onDone={() => {
          close()
          reload()
        }}
        onBack={close}
      />
    )
  }

  const pending = (rows ?? []).filter((r) => r.status === 'assigned')
  const done = (rows ?? []).filter((r) => r.status !== 'assigned')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]">
          ← Главная
        </Link>
        <h1 className="text-2xl font-bold">📝 Задания</h1>
      </div>

      {loading ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (rows ?? []).length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🌤</p>
          <p className="mt-2 font-semibold">Заданий пока нет</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Когда преподаватель назначит задание, оно появится здесь.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--night-text-40)]">Новые</h2>
              {pending.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => setActive(r)} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--night-text-40)]">Выполненные</h2>
              {done.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => setActive(r)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function AssignmentCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const m = row.material
  return (
    <button onClick={onOpen} className="text-left">
      <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
        <div className="min-w-0">
          <p className="truncate font-medium">{m.title ?? m.topic}</p>
          <p className="text-xs text-[var(--night-text-40)]">
            {m.lang.toUpperCase()} · {m.level} · {m.format} · {m.exercises.length} упр.
            {(row.attempts?.length ?? 0) > 0 && row.status === 'assigned' && (
              <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
                · повторно
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-sm">
          {row.status === 'assigned' ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              новое
            </span>
          ) : row.status === 'submitted' ? (
            <span className="text-[var(--night-text-40)]">⏳ на проверке</span>
          ) : (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ {(row.teacher_review ?? []).filter((r) => r.ok).length}/{row.auto_total}
            </span>
          )}
        </span>
      </Card>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Разбор проверенной работы: вердикты и комментарии преподавателя.
// ---------------------------------------------------------------------------

function ReviewedView({
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
  const okCount = review.filter((r) => r.ok).length
  const percent = row.auto_total ? Math.round((okCount / row.auto_total) * 100) : 0
  const [showBody, setShowBody] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Задания
        </Button>
        <h1 className="min-w-0 truncate text-xl font-bold">{m.title ?? m.topic}</h1>
      </div>

      <Card className="text-center">
        <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
        <p className="mt-2 text-lg font-bold">
          Проверено преподавателем: {okCount} из {row.auto_total}
        </p>
        <p className="mt-1 text-sm text-[var(--night-text-40)]">Разбор по каждому упражнению ниже.</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="min-h-[44px] px-4 text-sm"
          onClick={() => setShowBody((s) => !s)}
        >
          {showBody ? 'Скрыть текст' : 'Перечитать текст'}
        </Button>
        <Button
          variant="ghost"
          className="min-h-[44px] px-4 text-sm"
          onClick={onRetry}
        >
          Пройти упражнения заново
        </Button>
      </div>
      {showBody && (
        <Card>
          {/* тот же тап по словам, что и в «Учёбе»: разобранный текст —
              лучший источник слов для колоды */}
          <p className="text-xs text-[var(--night-text-40)]">
            Нажми на незнакомое слово, чтобы посмотреть перевод и добавить в колоду.
          </p>
          <TappableBody body={m.body} lang={m.lang} />
        </Card>
      )}

      {m.exercises.map((ex, i) => {
        const item = review.find((r) => r.index === i)
        const given = answers.find((a) => a.index === i)?.given ?? '(нет ответа)'
        const correct =
          ex.type === 'mcq' ? ex.options[ex.answer] : ex.type === 'fill' ? ex.answer : ''
        const ok = item?.ok ?? false
        return (
          <Card key={i} className="flex flex-col gap-1.5">
            <p className="text-xs text-[var(--night-text-40)]">{i + 1}</p>
            <p className="text-sm font-medium">{ex.prompt}</p>
            <p className="text-sm">
              Твой ответ:{' '}
              <span className={ok ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-500'}>
                {given} {ok ? '✓' : '✗'}
              </span>
              {!ok && correct && <span className="text-[var(--night-text-40)]"> · правильно: {correct}</span>}
            </p>
            {item?.comment && (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-[var(--night-text-70)] dark:bg-sky-950/40 dark:text-slate-200">
                💬 {item.comment}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Прохождение задания: текст → упражнения → сдача.
// ---------------------------------------------------------------------------

function AssignmentRunner({
  row,
  onDone,
  onBack,
}: {
  row: Row
  onDone: () => void
  onBack: () => void
}) {
  const m = row.material
  const [stage, setStage] = useState<'read' | 'exercises' | 'result'>('read')
  const [index, setIndex] = useState(0)
  // ответы по индексу упражнения (а не push) — повторный ответ на то же
  // упражнение перезаписывает запись, не задваивая балл и не плодя дубли.
  const [answerMap, setAnswerMap] = useState<Record<number, AssignmentAnswer>>({})
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
    setStage('result')
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

  if (stage === 'read') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
            ← Задания
          </Button>
          <h1 className="min-w-0 truncate text-xl font-bold">{m.title ?? m.topic}</h1>
        </div>

        {row.note && row.status === 'assigned' && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              💬 Комментарий преподавателя: {row.note}
            </p>
          </Card>
        )}

        <Card>
          <p className="text-xs text-[var(--night-text-40)]">
            {m.level} · {m.format} · прочитай внимательно — упражнения по тексту.
            Нажимай на незнакомые слова, чтобы добавить их в колоду.
          </p>
          <TappableBody body={m.body} lang={m.lang} />
        </Card>
        <Button onClick={() => setStage('exercises')}>
          {alreadyDone ? 'Пройти ещё раз (без пересдачи) →' : `К упражнениям (${total}) →`}
        </Button>
        {alreadyDone && (
          <p className="text-center text-xs text-[var(--night-text-40)]">
            Работа уже сдана ({row.auto_score}/{row.auto_total}) — повторное прохождение не отправляется.
          </p>
        )}
      </div>
    )
  }

  if (stage === 'result') {
    const percent = total ? Math.round((correct / total) * 100) : 0
    return (
      <Card className="text-center">
        <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
        <p className="mt-2 text-lg font-bold">
          {correct} из {total} верно ({percent}%)
        </p>
        {!alreadyDone && (
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            {saving
              ? 'Отправляю работу преподавателю…'
              : saveError
                ? saveError
                : 'Работа отправлена преподавателю на проверку ✓'}
          </p>
        )}
        <Button className="mt-4" onClick={onDone}>
          К заданиям
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <button onClick={() => setStage('read')} className="font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]">
          ↑ перечитать текст
        </button>
        <span>
          {index + 1} / {total} · верно: {correct}
        </span>
      </div>
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


// ---------------------------------------------------------------------------
// Текст задания с кликабельными словами (общая шторка WordSheet).
// ---------------------------------------------------------------------------

function TappableBody({ body, lang }: { body: string; lang: AppLang }) {
  const [pick, setPick] = useState<WordPick | null>(null)

  return (
    <>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[var(--night-text-70)]">
        <TappableText text={body} onSelect={setPick} />
      </p>
      {pick && (
        <WordSheet
          word={pick.word}
          sentence={pick.sentence}
          lang={lang}
          onClose={() => setPick(null)}
        />
      )}
    </>
  )
}
