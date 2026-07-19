// ============================================================================
// «Задания» ученицы: назначенные преподавателем материалы — текст + упражнения.
// Прохождение: чтение → упражнения (общий движок) → сдача (авто-балл, статус
// submitted). Проверка преподавателем — следующая фаза фичи.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ExerciseView } from '../../components/exercises'
import { logActivity } from '../../lib/activity'
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
  const [rows, setRows] = useState<Row[] | null>(null)
  const [active, setActive] = useState<Row | null>(null)

  const reload = useCallback(() => {
    getMyAssignments().then(setRows).catch(() => setRows([]))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (active) {
    // проверенная работа — сначала разбор от преподавателя
    if (active.status === 'reviewed') {
      return <ReviewedView row={active} onBack={() => setActive(null)} />
    }
    return (
      <AssignmentRunner
        row={active}
        onDone={() => {
          setActive(null)
          reload()
        }}
        onBack={() => setActive(null)}
      />
    )
  }

  const pending = (rows ?? []).filter((r) => r.status === 'assigned')
  const done = (rows ?? []).filter((r) => r.status !== 'assigned')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Главная
        </Link>
        <h1 className="text-2xl font-bold">📝 Задания</h1>
      </div>

      {rows === null ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🌤</p>
          <p className="mt-2 font-semibold">Заданий пока нет</p>
          <p className="mt-1 text-sm text-slate-500">
            Когда преподаватель назначит задание, оно появится здесь.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">Новые</h2>
              {pending.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => setActive(r)} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">Выполненные</h2>
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
          <p className="text-xs text-slate-400">
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
            <span className="text-slate-400">⏳ на проверке</span>
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

function ReviewedView({ row, onBack }: { row: Row; onBack: () => void }) {
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
        <p className="mt-1 text-sm text-slate-500">Разбор по каждому упражнению ниже.</p>
      </Card>

      <button
        onClick={() => setShowBody((s) => !s)}
        className="self-start text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        {showBody ? '▾ Скрыть текст' : '▸ Перечитать текст'}
      </button>
      {showBody && (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {m.body}
          </p>
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
            <p className="text-xs text-slate-400">{i + 1}</p>
            <p className="text-sm font-medium">{ex.prompt}</p>
            <p className="text-sm">
              Твой ответ:{' '}
              <span className={ok ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-500'}>
                {given} {ok ? '✓' : '✗'}
              </span>
              {!ok && correct && <span className="text-slate-400"> · правильно: {correct}</span>}
            </p>
            {item?.comment && (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-slate-700 dark:bg-sky-950/40 dark:text-slate-200">
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
  const [answers, setAnswers] = useState<AssignmentAnswer[]>([])
  const [correct, setCorrect] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const alreadyDone = row.status !== 'assigned'
  const total = m.exercises.length
  const current = m.exercises[index]

  // ответ на текущее упражнение (ok приходит из onAnswered, given — из onGiven)
  const pendingRef = useState<{ ok: boolean; given: string }>({ ok: false, given: '' })[0]

  const onAnswered = (ok: boolean) => {
    pendingRef.ok = ok
    if (ok) setCorrect((c) => c + 1)
  }
  const onGiven = (given: string) => {
    pendingRef.given = given
    setAnswers((arr) => [
      ...arr,
      { index, given, auto_ok: pendingRef.ok },
    ])
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
          <p className="text-xs text-slate-400">
            {m.level} · {m.format} · прочитай внимательно — упражнения по тексту.
            Нажимай на незнакомые слова, чтобы добавить их в колоду.
          </p>
          <TappableBody body={m.body} lang={m.lang} />
        </Card>
        <Button onClick={() => setStage('exercises')}>
          {alreadyDone ? 'Пройти ещё раз (без пересдачи) →' : `К упражнениям (${total}) →`}
        </Button>
        {alreadyDone && (
          <p className="text-center text-xs text-slate-400">
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
          <p className="mt-1 text-sm text-slate-500">
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
      <div className="flex items-center justify-between text-sm text-slate-400">
        <button onClick={() => setStage('read')} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
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
// Текст задания с кликабельными словами: тап → словарь → «в колоду».
// EN — Free Dictionary API (определение + транскрипция), ES — паки → Gemini.
// ---------------------------------------------------------------------------

function TappableBody({ body, lang }: { body: string; lang: AppLang }) {
  const [selected, setSelected] = useState<string | null>(null)
  const tokens = useMemo(() => body.split(/(\s+)/), [body])

  return (
    <>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
        {tokens.map((tok, i) => {
          const isWord = /[A-Za-zÀ-ÿ]/.test(tok)
          if (!isWord) return <span key={i}>{tok}</span>
          return (
            <span
              key={i}
              onClick={() => setSelected(tok.replace(/[^A-Za-zÀ-ÿ'-]/g, ''))}
              className="cursor-pointer rounded px-0.5 hover:bg-sky-100 active:bg-sky-200 dark:hover:bg-sky-900/50"
            >
              {tok}
            </span>
          )
        })}
      </p>
      {selected && (
        <WordSheet word={selected} lang={lang} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

interface WordInfo {
  word: string
  back?: string
  example?: string
  ipa?: string
  audio_url?: string
}

function WordSheet({
  word,
  lang,
  onClose,
}: {
  word: string
  lang: AppLang
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<WordInfo | null>(null)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setAdded(false)
    setError(null)
    const load = async (): Promise<WordInfo | null> => {
      if (lang === 'es') {
        const r = await lookupSpanish(word)
        if (!r) return null
        return { word: r.word, back: r.translation, example: r.example }
      }
      const r = await lookup(word)
      if (!r) return null
      return {
        word: r.word,
        back: r.definition,
        example: r.example,
        ipa: r.ipa,
        audio_url: r.audio_url,
      }
    }
    load()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false))
  }, [word, lang])

  const playAudio = () => {
    if (info?.audio_url) {
      new Audio(info.audio_url).play().catch(() => speak(word, { lang }))
    } else {
      speak(info?.word ?? word, { lang })
    }
  }

  const addToDeck = async () => {
    setBusy(true)
    setError(null)
    try {
      await addCard({
        front: info?.word ?? word.toLowerCase(),
        back: info?.back,
        example: info?.example,
        ipa: info?.ipa,
        audio_url: info?.audio_url,
        lang,
        source: 'reader',
      })
      setAdded(true)
      void logActivity('reader')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить слово')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{info?.word ?? word.toLowerCase()}</h3>
          <button
            onClick={playAudio}
            className="rounded-full bg-slate-100 px-3 py-1 text-lg dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>

        {info?.ipa && <p className="mt-1 text-slate-400">/{info.ipa}/</p>}

        {loading ? (
          <p className="mt-3 text-slate-500">Ищу в словаре…</p>
        ) : info?.back ? (
          <div className="mt-3">
            <p className="text-slate-700 dark:text-slate-200">{info.back}</p>
            {info.example && (
              <p className="mt-2 text-sm italic text-slate-500">«{info.example}»</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-slate-500">
            Перевод не найден, но слово всё равно можно добавить в колоду.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex gap-3">
          {added ? (
            <Button variant="secondary" className="flex-1" disabled>
              Добавлено ✓
            </Button>
          ) : (
            <Button className="flex-1" onClick={addToDeck} disabled={busy}>
              {busy ? 'Добавляю…' : '+ В колоду'}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  )
}
