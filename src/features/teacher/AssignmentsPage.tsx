// ============================================================================
// Экран «Домашка» у ученика (роут /assignments).
//
// Сверху — домашка на неделю одним списком: срок, счёт, пункты с прогрессом
// внутри. Ниже — задания-материалы от преподавателя, как было. Раннер задания
// (текст → упражнения → сдача) не изменился и живёт там же, под ?a=<id>.
//
// ⚠️ ПОЧЕМУ ДОМАШКА ЖИВЁТ ЗДЕСЬ, А НЕ ОТДЕЛЬНЫМ РОУТОМ. У одной работы должен
// остаться ОДИН способ её сделать. Домашка — указатель: её пункты открывают те
// же экраны (/quests, /writing, /practice, /pronunciation) и тот же раннер
// задания. Заведи домашка свои кнопки «сдать» — и получилось бы два пути
// закрыть одно и то же, а на «своём» экране работа осталась бы новой.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, ScoreGlyph } from '../../components/RoundResult'
import { ExerciseView } from '../../components/exercises'
import { correctAnswerText } from '../../lib/text'
import type { ReviewItem } from '../../components/RoundReview'
import { MarkableText } from '../../components/MarkableText'
import { logActivity } from '../../lib/activity'
import { useAsyncData } from '../../lib/useAsyncData'
import { LoadError } from '../../components/LoadError'
import { IconTray } from '../../components/icons'
import {
  getMyAssignments,
  submitAssignment,
} from '../../lib/materials'
import { getHomework, type Homework } from '../../lib/homework'
import { StudentHomework } from '../homework/StudentHomework'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlStates } from '../../lib/useUrlState'
import { RowsSkeleton } from '../../components/Loading'
import type {
  AppLang,
  AssignmentAnswer,
  Material,
  MaterialAssignment,
} from '../../types'

type Row = MaterialAssignment & { material: Material }

/**
 * Стадия прохождения задания — живёт в адресе (?stage=).
 * Итога раунда здесь нет намеренно: результат — это ход раунда, а не место.
 * После F5 он показал бы честный «0 из 13» вместо набранного, поэтому остаётся
 * локальным состоянием раннера (правило из lib/useUrlState.ts).
 */
type Stage = 'read' | 'exercises' | 'review'
const STAGES: string[] = ['read', 'exercises', 'review']
/** Константа, а не литерал на каждый рендер: иначе set из хука пересоздаётся зря. */
const URL_KEYS = ['a', 'stage']

/** Черновик прохождения: что уже отвечено и на каком упражнении человек стоит. */
type Draft = { answers: Record<number, AssignmentAnswer>; index: number }

export function AssignmentsPage() {
  const navigate = useNavigate()
  // Открытое задание и стадия — в адресе (?a=<id>&stage=read), а не в useState.
  // Раньше «назад» из упражнений выбрасывал на Главную мимо списка заданий,
  // F5 терял место, а по адресу нельзя было понять, что вообще открыто.
  // Именно useUrlStates: id и стадия меняются ОДНИМ движением, два отдельных
  // useUrlState затёрли бы друг друга (каждый читает свой снимок params).
  const [url, setUrl] = useUrlStates(URL_KEYS)
  // ?? null — из-за noUncheckedIndexedAccess чтение по ключу даёт ещё и undefined
  const activeId = url.a ?? null

  // при сбое показываем ошибку, а не «Заданий пока нет»: раньше ученик
  // думал, что работы нет, и не повторял попытку
  const {
    data: rows,
    error,
    loading,
    reload,
  } = useAsyncData<Row[]>(() => getMyAssignments(), [], 'Не удалось загрузить задания')

  // Домашку тянем отдельно и молча: если её нет или запрос упал, экран обязан
  // остаться рабочим списком заданий — как был до этого захода.
  const { data: hw, reload: reloadHw } = useAsyncData<Homework | null>(
    () => getHomework().catch(() => null),
    [],
    '',
  )

  const active = activeId ? ((rows ?? []).find((r) => r.id === activeId) ?? null) : null
  // стадия по умолчанию зависит от работы: проверенную открываем с разбора
  // преподавателя, остальные — с текста. Мусор в адресе трактуется как «нет».
  const stage: Stage = STAGES.includes(url.stage ?? '')
    ? (url.stage as Stage)
    : active?.status === 'reviewed'
      ? 'review'
      : 'read'

  useScrollTop(activeId)

  // Ответы переживают уход из задания: вышел кареткой в список, вернулся —
  // набранное на месте (раньше любой выход обнулял работу — главная жалоба
  // ревью навигации). ref, а не state: список от черновика не зависит,
  // перерисовывать его из-за каждой буквы незачем.
  const draftsRef = useRef<Record<string, Draft>>({})

  const open = (row: Row) =>
    setUrl({ a: row.id, stage: row.status === 'reviewed' ? 'review' : 'read' })
  const close = () => setUrl({ a: null, stage: null })
  const setStage = (s: Stage) => setUrl({ a: activeId, stage: s })

  // Чужая или устаревшая ссылка (задание сняли, id из чужой переписки): такого
  // задания у ученика нет — возвращаем в список, а не показываем пустоту.
  // Ждём именно загрузки rows, иначе F5 внутри задания вышибал бы наружу.
  useEffect(() => {
    if (activeId && rows && !rows.some((r) => r.id === activeId)) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, rows])

  if (active) {
    // проверенная работа — сначала разбор от преподавателя;
    // «Пройти заново» переключает на упражнения (без пересдачи)
    if (stage === 'review') {
      return <ReviewedView row={active} onBack={close} onRetry={() => setStage('read')} />
    }
    return (
      <AssignmentRunner
        // смена задания через адрес (?a=другое) обязана начинать раннер заново
        key={active.id}
        row={active}
        stage={stage}
        onStage={setStage}
        drafts={draftsRef.current}
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

  const nothingAtAll = !hw && (rows ?? []).length === 0

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={() => navigate('/study')} title="Домашка" label="К учёбе" />

      {hw && <StudentHomework hw={hw} onChanged={reloadHw} />}

      {loading ? (
        <RowsSkeleton count={3} />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : nothingAtAll ? (
        <Card className="text-center">
          <IconTray size={38} className="mx-auto block text-[var(--night-text-40)]" />
          <p className="mt-2 font-semibold">Пока ничего не задано</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Когда преподаватель выдаст домашку или задание, они появятся здесь.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--night-text-40)]">
                {hw ? 'Задания от преподавателя' : 'Новые'}
              </h2>
              {pending.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => open(r)} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--night-text-40)]">Выполненные</h2>
              {done.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => open(r)} />
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
              <span className="ml-1 font-semibold text-amber-400">
                · повторно
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-right text-sm">
          {row.status === 'assigned' ? (
            <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-xs font-semibold text-amber-300">
              новое
            </span>
          ) : row.status === 'submitted' ? (
            <>
              <span className="block text-[var(--night-text-40)]">на проверке</span>
              <span className="block text-xs text-[var(--night-accent-text)]">тренироваться →</span>
            </>
          ) : (
            <>
              <span className="block font-semibold text-emerald-400">
                ✓ {(row.teacher_review ?? []).filter((r) => r.ok).length}/{row.auto_total}
              </span>
              <span className="block text-xs text-[var(--night-accent-text)]">тренироваться →</span>
            </>
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
      <BackHeader onBack={onBack} title={m.title ?? m.topic} label="К заданиям" />

      <Card className="flex flex-col items-center text-center">
        <ScoreGlyph percent={percent} />
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
              <span className={ok ? 'font-semibold text-emerald-400' : 'font-semibold text-red-500'}>
                {given} {ok ? '✓' : '✗'}
              </span>
              {!ok && correct && <span className="text-[var(--night-text-40)]"> · правильно: {correct}</span>}
            </p>
            {item?.comment && (
              <p className="rounded-lg bg-sky-950/40 px-3 py-2 text-sm text-slate-200">
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
  stage,
  onStage,
  drafts,
  onDone,
  onBack,
}: {
  row: Row
  stage: Stage
  onStage: (s: Stage) => void
  /** Общий на всю страницу склад черновиков — переживает размонтирование раннера. */
  drafts: Record<string, Draft>
  onDone: () => void
  onBack: () => void
}) {
  const m = row.material
  useScrollTop(stage)
  // стартуем с того места, где человек остановился в прошлый заход
  const [index, setIndex] = useState(() => drafts[row.id]?.index ?? 0)
  // ответы по индексу упражнения (а не push) — повторный ответ на то же
  // упражнение перезаписывает запись, не задваивая балл и не плодя дубли.
  const [answerMap, setAnswerMap] = useState<Record<number, AssignmentAnswer>>(
    () => drafts[row.id]?.answers ?? {},
  )
  // Итог раунда в адрес не пишем (см. Stage), но и залипать на нём нельзя:
  // системная кнопка «назад» меняет стадию — значит, итог надо снять.
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    setFinished(false)
  }, [stage])
  // черновик наружу — чтобы выход в список не стирал набранное
  useEffect(() => {
    drafts[row.id] = { answers: answerMap, index }
  }, [drafts, row.id, answerMap, index])
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
    // раунд закончен — черновик больше не нужен: следующий заход («тренироваться
    // ещё раз») должен начинаться с чистого листа, а не с прошлых ответов
    delete drafts[row.id]
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
          <Card className="border-amber-700 bg-amber-950/30">
            <p className="text-sm text-amber-200">
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
        <Button onClick={() => onStage('exercises')}>
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
      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <button onClick={() => onStage('read')} className="font-medium text-[var(--night-accent-text)] hover:underline">
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
// Текст задания: тап-словарь + режим «Отметить слова» (общий MarkableText).
// ---------------------------------------------------------------------------

function TappableBody({ body, lang }: { body: string; lang: AppLang }) {
  return (
    <div className="mt-3">
      <MarkableText
        text={body}
        lang={lang}
        className="whitespace-pre-wrap leading-relaxed text-[var(--night-text-70)]"
      />
    </div>
  )
}
