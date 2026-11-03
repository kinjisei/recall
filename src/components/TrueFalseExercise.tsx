// ============================================================================
// «True / False / Not given» в задании по материалу (Ф2.25-1, макет u5-3):
// утверждение о тексте карточкой, внизу — две кнопки (у текста A1–A2) или
// три (с B1). Подписи — на языке текста: True / False / Not given,
// Verdadero / Falso / No se dice (журнал п.76 (18)); их кладёт в варианты
// упражнения генерация, экран показывает как есть. Заголовок — тоже на
// языке текста: «True or false?», «¿Verdadero o falso?» (п.76 (19)).
//
// После ответа — сразу итог, без второй попытки: из двух кнопок вторая
// попытка — это готовый ответ. Итог — «Правильно — False», коротко почему,
// строка из текста, где это видно (слово выделено), и балл.
// Сервер считает упражнение веткой mcq — по тексту выбранной кнопки.
// ============================================================================
import { useState } from 'react'
import { Button } from '../shared/ui/Button'
import { IconCheckCircle, IconXCircle } from '../shared/ui/icons'
import { useRoundKeys } from '../shared/ui/roundKeys'
import { RoundHead } from '../shared/ui/roundParts'
import { plural } from '../shared/lib/plural'
import type { AppLang, MaterialMcq } from '../types'

export interface TrueFalseProps {
  exercise: MaterialMcq
  lang?: AppLang
  /** Баллов до этого упражнения — для строки «+1 балл · 6 баллов». */
  score?: number
  onAnswered: (ok: boolean) => void
  onGiven?: (given: string) => void
  onNext: () => void
  isLast: boolean
}

const points = (n: number) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`

/** Строка из текста; `mark` в ней — выделено (первое совпадение, без учёта регистра). */
function Quote({ text, mark, lang }: { text: string; mark?: string; lang?: AppLang }) {
  const at = mark ? text.toLowerCase().indexOf(mark.toLowerCase()) : -1
  return (
    <blockquote lang={lang} className="rounded-tile border-l-3 border-success bg-surface px-3 py-2.5 text-sm leading-normal text-fg">
      {at < 0 || !mark ? (
        text
      ) : (
        <>
          {text.slice(0, at)}
          <mark className="rounded-mark bg-success-soft px-0.5 font-semibold text-success-strong">{text.slice(at, at + mark.length)}</mark>
          {text.slice(at + mark.length)}
        </>
      )}
    </blockquote>
  )
}

export function TrueFalseExercise({ exercise, lang, score, onAnswered, onGiven, onNext, isLast }: TrueFalseProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const done = picked !== null
  const ok = picked === exercise.answer
  const three = exercise.options.length > 2
  const right = exercise.options[exercise.answer] ?? ''

  const choose = (i: number) => {
    if (done || i >= exercise.options.length) return
    onAnswered(i === exercise.answer)
    onGiven?.(exercise.options[i] ?? '')
    setPicked(i)
  }
  useRoundKeys({ pick: choose, enter: () => done && onNext() })

  return (
    <div className="flex flex-1 flex-col">
      <RoundHead title={lang === 'es' ? '¿Verdadero o falso?' : 'True or false?'} sub="По тексту — прочитай внимательно" />
      <p lang={lang} className="mt-1.5 rounded-row bg-surface p-4.5 text-xl leading-normal font-medium text-fg shadow-card">
        {exercise.prompt}
      </p>

      {done && (
        <div role="status" className="mt-4 flex flex-col gap-3">
          <p className="flex gap-2.5 text-body leading-snug text-fg">
            {ok ? (
              <IconCheckCircle size={20} aria-hidden className="mt-0.5 flex-none text-success-strong" />
            ) : (
              <IconXCircle size={20} aria-hidden className="mt-0.5 flex-none text-danger-strong" />
            )}
            <span>
              <b className={`block font-semibold ${ok ? 'text-success-strong' : 'text-danger-strong'}`}>
                {ok ? 'Правильно' : 'Не совсем, правильно'} — <span lang={lang}>{right}</span>
              </b>
              {exercise.why}
            </span>
          </p>
          {exercise.quote && <Quote text={exercise.quote} mark={exercise.mark} lang={lang} />}
          {ok && score !== undefined && <p className="text-note text-fg-secondary">+1 балл · {points(score + 1)}</p>}
        </div>
      )}

      <div className="mt-auto pt-4 @xl/round:mt-6 @xl/round:pt-0">
        {done ? (
          <div className="@xl/round:flex @xl/round:justify-end">
            <Button size="lg" className="w-full @xl/round:w-auto @xl/round:min-h-13 @xl/round:rounded-control @xl/round:px-5.5 @xl/round:text-base" onClick={onNext}>
              {isLast ? 'Завершить' : 'Дальше'}
            </Button>
          </div>
        ) : (
          <div className={`grid gap-2.5 ${three ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {exercise.options.map((o, i) => (
              <button
                key={i}
                type="button"
                data-key={i + 1}
                lang={lang}
                onClick={() => choose(i)}
                className={`flex items-center justify-center rounded-control-lg bg-surface px-2 font-semibold text-fg shadow-card inset-ring inset-ring-line transition-[transform,background-color] duration-150 hover:bg-row-press active:scale-[0.99] ${
                  three ? 'min-h-13 text-body' : 'min-h-15 text-lg'
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
