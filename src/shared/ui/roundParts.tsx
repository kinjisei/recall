// ============================================================================
// Детали упражнения по макету d5 — одни на все игры «Практики» и движок
// упражнений (components/exercises): подпись задания, вопрос крупно с
// «озвучить», вариант ответа с номером клавиши и состоянием, итог ответа и
// низ с главной кнопкой. Крупные размеры (слово 44, вариант 60) — когда
// колонка раунда шире 576 px (`@container/round` в RoundFrame); вне раунда
// (урок грамматики, материал) — размер телефона.
// ============================================================================
import type { ReactNode } from 'react'
import { IconCheck, IconCheckCircle, IconClose, IconSpeaker, IconXCircle } from './icons'

/** Что сделать — над вопросом: «Выбери перевод», «Соедини пары». */
export function RoundTask({ children }: { children: ReactNode }) {
  return <p className="text-body font-medium text-fg-muted">{children}</p>
}

/** Вопрос крупно (слово — 44, фраза длиннее 24 знаков — 24) и «озвучить» рядом. */
export function RoundPrompt({ text, onSay, sub }: { text: string; onSay?: () => void; sub?: ReactNode }) {
  const long = text.length > 24
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3.5">
        <p
          className={`min-w-0 font-semibold tracking-tight text-fg ${
            long ? 'text-xl leading-snug @xl/round:text-2xl' : 'text-3xl leading-tight @xl/round:text-headline'
          }`}
        >
          {text}
        </p>
        {onSay && (
          <button
            type="button"
            onClick={onSay}
            aria-label="Озвучить"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"
          >
            <IconSpeaker size={22} />
          </button>
        )}
      </div>
      {sub && <div className="text-lg text-fg-secondary @xl/round:text-xl">{sub}</div>}
    </div>
  )
}

/** Большая кнопка «прослушать» вместо слова (аудирование, диктант). */
export function RoundListen({ onSay }: { onSay: () => void }) {
  return (
    <button
      type="button"
      onClick={onSay}
      aria-label="Прослушать ещё раз"
      className="flex size-20 items-center justify-center self-start rounded-full bg-accent-soft text-accent-soft-fg"
    >
      <IconSpeaker size={32} />
    </button>
  )
}

export type OptionState = 'idle' | 'sel' | 'ok' | 'bad' | 'off'

/** Вид варианта (d5): поверхность и черта; выбран — мягкий акцент и рамка фокуса; итог — зелёным или красным. */
export const OPTION_LOOK: Record<OptionState, string> = {
  idle: 'bg-surface text-fg shadow-card inset-ring inset-ring-line hover:bg-row-press active:scale-[0.99]',
  sel: 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus',
  ok: 'bg-success-soft text-fg inset-ring-2 inset-ring-success',
  bad: 'bg-danger-soft text-fg inset-ring-2 inset-ring-danger',
  off: 'bg-surface text-fg shadow-card inset-ring inset-ring-line opacity-55',
}

/** Размер варианта: 56 на телефоне, 60 в широкой колонке раунда (d5). */
export const OPTION_SIZE =
  'flex min-h-14 items-center rounded-control px-4 text-left text-base font-medium transition-[transform,background-color,color,box-shadow] duration-150 @xl/round:min-h-15 @xl/round:pl-3.5 @xl/round:text-lg'

/**
 * Вариант ответа: номер клавиши рисует index.css по `data-key` (только при
 * мыши), состояние — `data-state` и подпись справа («Верно», «Правильно»,
 * «Твой ответ»). Текст кнопки — сам ответ: его сверяют проверки и читает
 * читалка.
 */
export function RoundOption({
  n,
  state,
  mark,
  pop = false,
  disabled,
  onClick,
  className = '',
  children,
}: {
  /** Номер клавиши 1–9; без него — без плашки номера. */
  n?: number
  state: OptionState
  /** Подпись справа при итоге: «Верно» / «Правильно» / «Твой ответ». */
  mark?: string
  /** Короткий «клевок» собственного верного ответа. */
  pop?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      data-key={n}
      data-state={state}
      aria-pressed={state === 'sel' || undefined}
      onClick={onClick}
      disabled={disabled}
      className={`${OPTION_SIZE} ${OPTION_LOOK[state]}${pop ? ' animate-answer-pop' : ''} ${className}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {mark && (state === 'ok' || state === 'bad') && (
        <span className={`ml-3 flex flex-none items-center gap-1.5 text-sm font-semibold ${state === 'ok' ? 'text-success-strong' : 'text-danger-strong'}`}>
          {state === 'ok' ? <IconCheck size={16} aria-hidden /> : <IconClose size={16} aria-hidden />}
          {mark}
        </span>
      )}
    </button>
  )
}

/** Итог ответа (d5): значок, «Верно! / Не совсем» и пара «слово — перевод». */
export function RoundFeedback({ ok, title, children }: { ok: boolean; title?: string; children?: ReactNode }) {
  return (
    // верный ответ — «клевок» (класс «момент правильного ответа», smoke-motion)
    <div role="status" className={`flex flex-1 items-center gap-2.5 text-base font-semibold ${ok ? 'animate-answer-pop text-success-strong' : 'text-danger-strong'}`}>
      {ok ? <IconCheckCircle size={22} aria-hidden className="flex-none" /> : <IconXCircle size={22} aria-hidden className="flex-none" />}
      <span className="min-w-0">
        {title ?? (ok ? 'Верно!' : 'Не совсем')}
        {children && <span className="block text-sm font-normal text-fg-secondary">{children}</span>}
      </span>
    </div>
  )
}

/** Низ упражнения: слева подсказка или итог, справа главная кнопка; на телефоне — столбиком, кнопка на всю ширину. */
export function RoundFooter({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-col gap-3.5 @xl/round:flex-row @xl/round:items-center">{children}</div>
}

/** Подсказка в низу упражнения, пока ответа нет. */
export function RoundHint({ children }: { children: ReactNode }) {
  return <p className="flex-1 text-sm text-fg-muted">{children}</p>
}

/** Подсказка о месте ошибки (самокоррекция, lib/selfCorrect) — одна на все упражнения. */
export function MistakeHint({ text }: { text: string }) {
  return (
    <p className="rounded-tile bg-warning/10 px-3 py-2 text-sm text-warning-soft-fg">
      {text} <span className="text-fg-muted">Попробуй ещё раз.</span>
    </p>
  )
}

/** «Показать ответ» — выход для того, кто застрял; не прячем его. */
export function RevealAnswer({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 self-start text-sm font-medium text-accent-strong">
      Показать ответ
    </button>
  )
}

export interface BuildItem {
  w: string
  /** Место слова в исходном списке: одинаковые слова различаются по нему. */
  i: number
}

const CHIP =
  'min-h-11 min-w-11 rounded-tile px-3.5 text-base font-medium transition-[background-color,color,box-shadow] duration-150'

/**
 * Собрать фразу из слов (игра «Собери фразу», упражнение «Собери
 * предложение»): сверху поле сборки — пунктиром, после проверки зелёным или
 * красным; снизу банк слов в языке вариантов d5 (поверхность и черта), взятые
 * — на подложке поля; собранные — мягкий акцент в рамке фокуса, нажатие
 * возвращает слово в банк.
 */
export function RoundBuild({
  built,
  bank,
  result,
  onTake,
  onDrop,
}: {
  built: BuildItem[]
  bank: BuildItem[]
  /** null — ещё не проверено; true / false — итог. */
  result: boolean | null
  onTake: (item: BuildItem) => void
  onDrop: (index: number) => void
}) {
  const used = new Set(built.map((b) => b.i))
  const done = result !== null
  return (
    <>
      <div
        className={`mt-2 flex min-h-15 flex-wrap content-start gap-2 rounded-control p-2 ${
          !done ? 'border-2 border-dashed border-line' : result ? 'bg-success-soft inset-ring-2 inset-ring-success' : 'bg-danger-soft inset-ring-2 inset-ring-danger'
        }`}
      >
        {built.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onDrop(i)}
            disabled={done}
            className={`${CHIP} bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus`}
          >
            {b.w}
          </button>
        ))}
        {built.length === 0 && <span className="flex min-h-11 items-center px-1 text-sm text-fg-muted">нажимай слова снизу по порядку</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {bank.map((item) => (
          <button
            key={item.i}
            type="button"
            onClick={() => onTake(item)}
            disabled={done || used.has(item.i)}
            className={`${CHIP} ${used.has(item.i) ? 'bg-input text-fg-muted' : 'bg-surface text-fg shadow-card inset-ring inset-ring-line hover:bg-row-press'}`}
          >
            {item.w}
          </button>
        ))}
      </div>
    </>
  )
}
