// ============================================================================
// Раунд «вопрос + 4 варианта» (Пропуск, Перевод, Аудирование) — по макету d5.
// Рамка — общая RoundFrame: вверху «Выйти · Esc», полоска и «4 из 10»; на
// широком экране слева ход раунда, справа клавиши. В колонке: что сделать
// («Выбери перевод»), слово крупно с кнопкой «озвучить», варианты 60 с
// номером клавиши, внизу — подсказка или итог ответа («Верно! / Не совсем»
// и пара «слово — перевод») и «Проверить / Дальше».
// Ответ — в два шага только на компьютере, как в d5 («выбрать» →
// «Проверить», Enter); на телефоне — одним нажатием (журнал п.76 (17)).
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import { RoundResult } from '../../components/RoundResult'
import type { ReviewItem } from '../../components/RoundReview'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import type { PoolItem } from '../../lib/wordPool'
import { useIsDesktop } from '../../shared/lib/useMediaQuery'
import type { AppLang } from '../../types'
import { Button } from '../../shared/ui/Button'
import { useRoundKeys } from '../../shared/ui/roundKeys'
import { KEY_EXIT, RoundFrame, type RoundKey } from '../../shared/ui/RoundFrame'
import { RoundFeedback, RoundFooter, RoundHint, RoundListen, RoundOption, RoundPrompt, RoundTask, type OptionState } from '../../shared/ui/roundParts'
import { markWrong } from './gameUtils'

export interface Question {
  /** Текст задания; для аудирования пустой — вместо него кнопка «слушать». */
  prompt: string
  options: string[]
  answer: number
  item: PoolItem
  /** Что произносить вслух (аудирование). */
  say?: string
}

export function QuizRunner({
  title,
  task,
  questions,
  lang,
  onBack,
  onRestart,
}: {
  /** Как плитка в «Практике»: «Перевод слова». */
  title: string
  /** Что сделать — над словом: «Выбери перевод». */
  task: string
  questions: Question[]
  lang: AppLang
  onBack: () => void
  onRestart: () => void
}) {
  const twoStep = useIsDesktop()
  const [index, setIndex] = useState(0)
  /** Выбран, но ещё не проверен (компьютер). */
  const [chosen, setChosen] = useState<number | null>(null)
  /** Проверенный ответ. */
  const [picked, setPicked] = useState<number | null>(null)
  // ответы раунда для «Посмотреть результаты» (разбор с «Почему?») и хода раунда
  const [results, setResults] = useState<ReviewItem[]>([])

  const q = questions[index]
  const done = index >= questions.length
  const say = q?.say ?? (q && !q.prompt.includes('_') ? q.item.term : null)

  // аудирование: произносим слово при появлении вопроса
  useEffect(() => {
    if (q?.say) speak(q.say, { lang })
  }, [q, lang])

  useEffect(() => {
    if (done) void logActivity('practice')
  }, [done])

  const check = (i: number | null) => {
    if (!q || i === null || picked !== null || i >= q.options.length) return
    setPicked(i)
    const ok = i === q.answer
    setResults((r) => [...r, { prompt: q.prompt || q.say || '', given: q.options[i] ?? '', correct: q.options[q.answer] ?? '', ok }])
    if (!ok) markWrong(q.item, lang)
  }
  const choose = (i: number) => {
    if (!q || picked !== null || i >= q.options.length) return
    if (twoStep) setChosen(i)
    else check(i)
  }
  const advance = () => {
    setIndex((i) => i + 1)
    setChosen(null)
    setPicked(null)
  }
  const hear = () => say && speak(say, { lang })
  // 1–4 — вариант, Enter — «Проверить» / «Дальше», R — озвучить; Esc — выход,
  // его держит «Практика» (shared/ui/roundKeys)
  useRoundKeys(
    {
      pick: choose,
      enter: () => (picked !== null ? advance() : twoStep ? check(chosen) : undefined),
      say: say ? hear : undefined,
    },
    !done,
  )

  const keys: RoundKey[] = [
    { keys: ['1', '4'], range: true, label: 'выбрать' },
    { keys: ['Enter'], label: twoStep ? 'проверить, дальше' : 'дальше' },
    ...(say ? [{ keys: ['R'], label: 'озвучить' }] : []),
    KEY_EXIT,
  ]
  const frame = (children: ReactNode) => (
    <RoundFrame
      title={title}
      at={Math.min(index + 1, questions.length)}
      total={questions.length}
      results={results.map((r) => r.ok)}
      keys={keys}
      onExit={onBack}
    >
      {children}
    </RoundFrame>
  )

  if (done) {
    const correct = results.filter((r) => r.ok).length
    return frame(
      <RoundResult
        correct={correct}
        total={questions.length}
        review={results}
        lang={lang}
        note={correct < questions.length ? 'Слова с ошибками вернутся в ближайшее повторение.' : undefined}
        onRestart={() => {
          setIndex(0)
          setChosen(null)
          setPicked(null)
          setResults([])
          onRestart()
        }}
      />,
    )
  }

  // index < questions.length гарантирован веткой done выше — но компилятор
  // не связывает done и q, поэтому явный guard (в рантайме не сработает)
  if (!q) return null

  const stateOf = (i: number): OptionState => {
    if (picked === null) return chosen === i ? 'sel' : 'idle'
    if (i === q.answer) return 'ok'
    return i === picked ? 'bad' : 'off'
  }
  const right = picked === q.answer
  const pair = `${q.item.term} — ${q.item.translation}`
  const last = index + 1 >= questions.length

  return frame(
    <>
      <div className="flex flex-col gap-2">
        <RoundTask>{task}</RoundTask>
        {q.prompt ? <RoundPrompt text={q.prompt} onSay={say ? hear : undefined} /> : <RoundListen onSay={hear} />}
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        {q.options.map((opt, i) => (
          <RoundOption
            key={i}
            n={i + 1}
            state={stateOf(i)}
            mark={i === q.answer ? (picked === i ? 'Верно' : 'Правильно') : 'Твой ответ'}
            // празднуем только собственный верный ответ (см. exercises.tsx)
            pop={picked === i && i === q.answer}
            disabled={picked !== null}
            onClick={() => choose(i)}
          >
            {opt}
          </RoundOption>
        ))}
      </div>

      <RoundFooter>
        {picked === null ? (
          <RoundHint>{twoStep ? 'Выбери вариант мышью или клавишей 1–4' : 'Нажми на вариант — ответ проверится сразу'}</RoundHint>
        ) : (
          <RoundFeedback ok={right}>
            {right ? pair : `${pair}. ${q.item.card ? 'Слово вернётся в повторение' : 'Слово добавлено в повторение'}`}
          </RoundFeedback>
        )}
        {picked !== null ? (
          <Button className="flex-none @xl/round:px-5.5!" onClick={advance}>
            {last ? 'Итоги' : 'Дальше'}
          </Button>
        ) : (
          twoStep && (
            <Button className="flex-none @xl/round:px-5.5!" disabled={chosen === null} onClick={() => check(chosen)}>
              Проверить
            </Button>
          )
        )}
      </RoundFooter>
    </>,
  )
}
