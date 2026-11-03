// ============================================================================
// «Соедини пары» в задании по материалу (Ф2.25-1, макет u5): слева слова,
// справа переводы или объяснения вперемешку и лишний вариант (последнюю пару
// не угадать исключением). Нажал слово — нажал пару, без перетаскивания: на
// телефоне оно неудобно, а читалке недоступно. У соединённых — общий номер в
// кружке; нажал соединённую — разъединил (она ждёт новую пару). «Проверить»
// — когда соединено всё; после — какие пары верны и верный ответ у неверных.
//
// Балл — за каждую пару и по первой попытке: второй нет, итог пар — сам
// разбор. Сверка — lib/text `matchVerdicts`, так же считает сервер
// (submit_material, миграция 0017).
//
// На компьютере (u5-4): 1–8 — слово, A–J — вариант справа (по коду клавиши,
// на любой раскладке), Tab и Space — по списку, Backspace — разъединить
// выбранную пару, Enter — «Проверить» и «Дальше».
// ============================================================================
import { useMemo, useState } from 'react'
import { Button } from '../shared/ui/Button'
import { IconCheck, IconCheckCircle, IconClose, IconInfo, IconXCircle } from '../shared/ui/icons'
import { useRoundKeys } from '../shared/ui/roundKeys'
import { RoundHead } from '../shared/ui/roundParts'
import { plural } from '../shared/lib/plural'
import { matchVerdicts } from '../lib/text'
import type { AppLang, MatchExercise as MatchData } from '../types'

export interface MatchProps {
  exercise: MatchData
  /** Язык текста: у слов и объяснений — для читалки и озвучки. */
  lang?: AppLang
  onAnswered: (ok: boolean) => void
  /** Что соединено с каждым словом — по порядку `pairs` (ответ серверу). */
  onPairs?: (chosen: string[]) => void
  onGiven?: (given: string) => void
  onNext: () => void
  isLast: boolean
}

type Side = 'L' | 'R'
interface Pick {
  side: Side
  i: number
}

const TEXT = {
  translation: { title: 'Соедини слово и перевод', phone: 'Нажми слово, потом его перевод', pc: 'Выбери слово, потом перевод', list: 'Переводы' },
  definition: { title: 'Соедини слово и объяснение', phone: 'Нажми слово, потом его объяснение', pc: 'Выбери слово, потом объяснение', list: 'Объяснения' },
}

/** Число из строки — зерно перемешивания: один и тот же порядок при каждом открытии. */
function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Перемешивание с зерном (mulberry32 + Фишер–Йейтс). */
function shuffled<T>(arr: readonly T[], seed: number): T[] {
  let t = seed
  const rnd = () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Правые половины и лишние — вперемешку, и ни одна не стоит в ряд со своим словом. */
export function rightColumn(ex: MatchData): string[] {
  const all = [...ex.pairs.map((p) => p.right), ...(ex.extra ?? [])]
  const base = seedOf(JSON.stringify(ex.pairs))
  let best = all
  for (let k = 0; k < 20; k++) {
    best = shuffled(all, base + k)
    if (ex.pairs.every((p, i) => best[i] !== p.right)) break
  }
  return best
}

export function MatchExercise({ exercise, lang, onAnswered, onPairs, onGiven, onNext, isLast }: MatchProps) {
  const rights = useMemo(() => rightColumn(exercise), [exercise])
  const n = exercise.pairs.length
  const text = TEXT[exercise.format] ?? TEXT.translation
  // links[i] — какой вариант справа соединён со словом i; order — в каком
  // порядке соединяли (номер пары в кружке)
  const [links, setLinks] = useState<(number | null)[]>(() => Array.from({ length: n }, () => null))
  const [order, setOrder] = useState<number[]>([])
  const [sel, setSel] = useState<Pick | null>(null)
  const [verdicts, setVerdicts] = useState<boolean[] | null>(null)
  const checked = verdicts !== null

  const owner = (r: number) => links.indexOf(r)
  const pairNo = (l: number) => order.indexOf(l) + 1
  const left = links.filter((r) => r === null).length

  const link = (l: number, r: number) => {
    const was = owner(r)
    setLinks((prev) => prev.map((x, i) => (i === l ? r : i === was ? null : x)))
    setOrder((prev) => [...prev.filter((x) => x !== l && x !== was), l])
    setSel(null)
  }
  const unlink = (l: number) => {
    setLinks((prev) => prev.map((x, i) => (i === l ? null : x)))
    setOrder((prev) => prev.filter((x) => x !== l))
  }

  const tap = (p: Pick) => {
    if (checked) return
    if (p.side === 'L') {
      if (sel?.side === 'R') return link(p.i, sel.i)
      // соединённое — разъединяем, и оно ждёт новую пару
      if (links[p.i] !== null) {
        unlink(p.i)
        return setSel(p)
      }
      return setSel(sel?.side === 'L' && sel.i === p.i ? null : p)
    }
    if (sel?.side === 'L') return link(sel.i, p.i)
    const o = owner(p.i)
    if (o >= 0) {
      unlink(o)
      return setSel(p)
    }
    setSel(sel?.side === 'R' && sel.i === p.i ? null : p)
  }

  const check = () => {
    if (checked || left > 0) return
    const chosen = links.map((r) => (r === null ? '' : (rights[r] ?? '')))
    const v = matchVerdicts(exercise, chosen)
    // ⚠️ Балл — по первой попытке: колбэки — один раз (как у всех упражнений)
    onAnswered(v.every(Boolean))
    onPairs?.(chosen)
    onGiven?.(exercise.pairs.map((p, i) => `${p.left} → ${chosen[i]}`).join('; '))
    setVerdicts(v)
    setSel(null)
  }

  /** Backspace: разъединить пару под фокусом, а без фокуса — последнюю соединённую. */
  const erase = () => {
    if (checked) return
    const el = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[data-pair-side]') : null
    const side = el?.dataset.pairSide
    const i = Number(el?.dataset.pairIndex)
    const l = side === 'L' ? i : side === 'R' ? owner(i) : (order[order.length - 1] ?? -1)
    if (l >= 0 && links[l] !== null) unlink(l)
  }

  useRoundKeys({
    pick: (i) => i < n && tap({ side: 'L', i }),
    letter: (i) => i < rights.length && tap({ side: 'R', i }),
    erase,
    enter: () => (checked ? onNext() : check()),
  })

  if (checked) {
    const got = verdicts.filter(Boolean).length
    return (
      <div className="flex flex-1 flex-col">
        <RoundHead title={text.title} sub="Проверено" />
        <PairsChecked exercise={exercise} chosen={links.map((r) => (r === null ? '' : (rights[r] ?? '')))} verdicts={verdicts} lang={lang} />
        <p
          role="status"
          className={`mt-3.5 flex items-center gap-2.5 rounded-control px-3.5 py-3 text-base font-semibold ${got > 0 ? 'bg-success-soft text-success-strong' : 'bg-danger-soft text-danger-strong'}`}
        >
          {got > 0 ? <IconCheckCircle size={20} aria-hidden /> : <IconXCircle size={20} aria-hidden />}
          {got} из {n} {plural(n, 'пары', 'пар', 'пар')} — {got} {plural(got, 'балл', 'балла', 'баллов')}
        </p>
        <div className="mt-auto pt-4 @xl/round:mt-5.5 @xl/round:flex @xl/round:justify-end @xl/round:pt-0">
          <Button size="lg" className="w-full @xl/round:w-auto @xl/round:min-h-13 @xl/round:rounded-control @xl/round:px-5.5 @xl/round:text-base" onClick={onNext}>
            {isLast ? 'Завершить' : 'Дальше'}
          </Button>
        </div>
      </div>
    )
  }

  const cell = (side: Side, i: number, label: string) => {
    const paired = side === 'L' ? links[i] !== null : owner(i) >= 0
    const no = paired ? pairNo(side === 'L' ? i : owner(i)) : 0
    const selected = sel?.side === side && sel.i === i
    const key = side === 'L' ? String(i + 1) : String.fromCharCode(65 + i)
    const look = selected
      ? 'bg-primary font-semibold text-primary-fg shadow-raised -translate-y-px'
      : paired
        ? 'bg-accent-soft text-accent-soft-fg'
        : 'bg-surface text-fg shadow-card inset-ring inset-ring-line hover:bg-row-press active:scale-[0.99]'
    // одна сетка на обе колонки: ряды равной высоты — все кнопки высотой с
    // самую высокую, слово и вариант в ряду вровень (разная высота смотрелась криво)
    return (
      <li key={`${side}${i}`} className="flex" style={{ gridColumn: side === 'L' ? 1 : 2, gridRow: i + 1 }}>
        <button
          type="button"
          data-pair-side={side}
          data-pair-index={i}
          aria-pressed={selected}
          aria-label={paired ? `${label}, пара ${no}` : undefined}
          onClick={() => tap({ side, i })}
          className={`flex h-full min-h-14 w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-base leading-snug font-medium transition-[transform,background-color,color,box-shadow] duration-150 ${look}`}
        >
          {paired ? (
            <span aria-hidden className="flex size-6 flex-none items-center justify-center rounded-full bg-surface text-xs font-bold text-accent-soft-fg inset-ring-2 inset-ring-focus">
              {no}
            </span>
          ) : (
            <span
              aria-hidden
              className={`hidden h-6 min-w-6 flex-none items-center justify-center rounded-mark px-1.5 text-xs font-semibold pointer-fine:flex ${selected ? 'bg-primary-fg/20 text-primary-fg' : 'bg-input text-fg-secondary'}`}
            >
              {key}
            </span>
          )}
          {/* «ждёт пару» — справа, а не влезает — под словом: иначе узкая колонка рвала слово («lugg-age») */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span lang={side === 'L' || exercise.format === 'definition' ? lang : undefined} className="min-w-0">
              {label}
            </span>
            {selected && <small className="ml-auto flex-none text-xs font-medium">ждёт пару</small>}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <RoundHead
        title={text.title}
        sub={
          <>
            <span className="pointer-fine:hidden">{text.phone}</span>
            <span className="hidden pointer-fine:inline">{text.pc}</span>
          </>
        }
      />
      <ul
        aria-label={`Слова и ${text.list.toLowerCase()}`}
        // у объяснений колонка слов на телефоне уже: строки объяснения короче —
        // и все кнопки ниже (высота ряда — по самой высокой кнопке)
        className={`grid auto-rows-fr gap-x-2.5 gap-y-2 @xl/round:grid-cols-[12.5rem_minmax(0,1fr)] ${
          exercise.format === 'definition' ? 'grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]'
        }`}
      >
        {exercise.pairs.map((p, i) => cell('L', i, p.left))}
        {rights.map((r, i) => cell('R', i, r))}
      </ul>
      <p className="mt-3.5 flex items-center gap-2 text-sm text-fg-secondary @xl/round:hidden">
        <IconInfo size={18} aria-hidden className="flex-none text-fg-muted" />
        Нажми на соединённую пару, чтобы её разъединить
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-4 @xl/round:mt-5.5 @xl/round:flex-row @xl/round:items-center @xl/round:gap-3.5 @xl/round:pt-0">
        <p className="text-center text-sm text-fg-secondary @xl/round:flex-1 @xl/round:text-left @xl/round:text-fg-muted" aria-live="polite">
          {left > 0 ? `Соедини ещё ${left} ${plural(left, 'слово', 'слова', 'слов')}` : 'Всё соединено — проверь'}
          <span className="hidden @xl/round:inline"> · нажми пару, чтобы разъединить</span>
        </p>
        <Button size="lg" className="w-full @xl/round:w-auto @xl/round:min-h-13 @xl/round:rounded-control @xl/round:px-5.5 @xl/round:text-base" disabled={left > 0} onClick={check}>
          Проверить
        </Button>
      </div>
    </div>
  )
}

/**
 * Пары после проверки (u5-2): слово, что соединено (неверное — зачёркнуто, под
 * ним «верно: …»), ✓ или ×. Им же ученик видит пары в разборе проверенной
 * работы; `verdicts` — отметки у пар (учителя или авто-проверки).
 */
export function PairsChecked({ exercise, chosen, verdicts, lang }: { exercise: MatchData; chosen: readonly string[]; verdicts: readonly boolean[]; lang?: AppLang }) {
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-control-lg bg-surface shadow-card">
      {exercise.pairs.map((p, i) => {
        const ok = verdicts[i]
        const c = chosen[i] ?? ''
        return (
          <li key={i} className={`flex min-h-14.5 items-center gap-2.5 px-3.5 py-2 ${ok ? '' : 'bg-danger-soft'}`}>
            <span lang={lang} className="w-[38%] flex-none text-base font-semibold text-fg">
              {p.left}
            </span>
            <span lang={exercise.format === 'definition' ? lang : undefined} className="flex min-w-0 flex-1 flex-col text-body leading-snug text-fg">
              {ok ? c : <s className="text-fg-secondary decoration-danger">{c || '—'}</s>}
              {!ok && <small className="text-note font-semibold text-success-strong">верно: {p.right}</small>}
            </span>
            <span
              aria-label={ok ? 'верно' : 'неверно'}
              className={`flex size-7 flex-none items-center justify-center rounded-full ${ok ? 'bg-success-soft text-success-strong' : 'bg-surface text-danger-strong'}`}
            >
              {ok ? <IconCheck size={16} aria-hidden /> : <IconClose size={16} aria-hidden />}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
