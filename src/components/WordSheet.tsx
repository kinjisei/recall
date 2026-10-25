// ============================================================================
// Общая словарная шторка для всех читалок (Ввод EN/ES, Задания):
// перевод слова В КОНТЕКСТЕ предложения (Gemini) + транскрипция/аудио (EN,
// Free Dictionary) + «в мои слова». Плюс TappableText — кликабельные слова.
//
// Шторка выше нижней навигации (z-50), контент прокручивается, кнопки всегда
// видны (safe-area учтён).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '../shared/ui/Sheet'
import { IconSearch, IconSpeaker } from '../shared/ui/icons'
import { Button } from '../shared/ui/Button'
import { AnalysisSheet } from './AnalysisSheet'
import type { AppLang } from '../types'
import { ErrorText } from '../shared/ui/ErrorText'
import { SheetHeader } from '../shared/ui/SheetHeader'
import { AddWordButton, WordFacts } from './WordDetails'
import { useWordLookup } from './wordLookup'

/** Выбранное слово + предложение, в котором оно встретилось. */
export interface WordPick {
  word: string
  sentence: string
  /** Где в тексте нажали — рамка у выбранного слова (d6). */
  at?: number
}

/** Обрезает пунктуацию по краям, сохраняя апострофы и дефисы внутри. */
export function cleanWord(token: string): string {
  return token.replace(/^[^A-Za-zÀ-ÿ]+/, '').replace(/[^A-Za-zÀ-ÿ'’-]+$/, '')
}

/** Предложение, покрывающее символ по индексу at (сканируем до знаков конца). */
function sentenceAt(text: string, at: number): string {
  // text[i] может дать undefined из-за индексации по типам — сравнение
  // с символами просто вернёт false, поведение то же, что и раньше
  const isEnd = (c: string | undefined) => c === '.' || c === '!' || c === '?' || c === '…'
  let start = Math.max(0, Math.min(at, text.length - 1))
  while (start > 0 && !isEnd(text[start - 1])) start--
  let end = Math.max(start, at)
  while (end < text.length && !isEnd(text[end])) end++
  if (end < text.length) end++ // включаем сам знак конца предложения
  return text.slice(start, end).trim().slice(0, 300)
}

/**
 * Предложение, в котором встречается слово (для контекстного перевода).
 *
 * at — позиция символа в тексте (начало токена, по которому тапнули). С ней
 * контекст берётся ИМЕННО там, где ты нажал: раньше искали первое вхождение по
 * подстроке во всём тексте, поэтому (1) слово, встречающееся дважды с разным
 * смыслом («will» как глагол и как существительное), всегда переводилось по
 * первому предложению, и (2) подстрока матчила чужое слово («art» находил
 * «start»). Без at — запасной путь: первое предложение с ЦЕЛЫМ словом.
 */
export function sentenceAround(text: string, word: string, at?: number): string {
  if (typeof at === 'number') return sentenceAt(text, at)
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const whole = new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, 'iu')
  const found = sentences.find((s) => whole.test(s))
  return (found ?? text).trim().slice(0, 300)
}

/**
 * Текст с кликабельными словами. Длинные тире (— –) и многоточия — разделители,
 * чтобы «exposure—reading» не склеивалось в одно слово.
 *
 * Тап по слову открывает его перевод. Долгое нажатие включает выделение
 * ФРАЗЫ: тянешь по соседним словам и получаешь перевод всего выражения
 * целиком («make up my mind»), а не по одному слову — по словам такие
 * идиомы не переводятся.
 */
export function TappableText({
  text,
  onSelect,
  selectMode = false,
  onPhrase,
  marked,
  activeAt,
}: {
  text: string
  onSelect: (pick: WordPick) => void
  /** Слова, которые уже в «Моих словах» (в нижнем регистре), — пунктиром (d6). */
  marked?: Set<string>
  /** Начало выбранного слова в тексте — оно в рамке, пока открыт перевод. */
  activeAt?: number | null
  /** Режим «Выделить фразу»: тап ПЕРВОГО и ПОСЛЕДНЕГО слова → onPhrase(фраза). */
  selectMode?: boolean
  onPhrase?: (phrase: string, sentence: string) => void
}) {
  const tokens = useMemo(() => text.split(/([\s—–…]+)/), [text])
  // Позиция начала каждого токена в тексте: split с захватом сохраняет всё,
  // поэтому смещения точные (tokens.join('') === text). Нужны, чтобы взять
  // контекст именно у тапнутого вхождения слова, а не у первого в тексте.
  const offsets = useMemo(() => {
    let o = 0
    return tokens.map((t) => {
      const start = o
      o += t.length
      return start
    })
  }, [tokens])
  const isWordToken = (tok: string) => /[A-Za-zÀ-ÿ]/.test(tok)

  // Индекс уже отмеченного ПЕРВОГО слова фразы (режим «Выделить фразу»).
  const [startIdx, setStartIdx] = useState<number | null>(null)
  useEffect(() => {
    if (!selectMode) setStartIdx(null)
  }, [selectMode])

  // Тап по слову = обычный click: браузер сам отличает касание от прокрутки, так
  // что нет конфликта со скроллом и «фантомных» кликов. В режиме «Выделить
  // фразу» первый тап ставит начало, второй — конец → onPhrase(фраза).
  const onWord = (tok: string, i: number) => {
    const word = cleanWord(tok)
    if (!word) return
    if (selectMode) {
      if (startIdx === null) {
        setStartIdx(i)
        return
      }
      const a = Math.min(startIdx, i)
      const b = Math.max(startIdx, i)
      const phrase = tokens
        .slice(a, b + 1)
        .join('')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ'’-]+$/g, '')
      setStartIdx(null)
      if (phrase) onPhrase?.(phrase, sentenceAround(text, word, offsets[a]))
      return
    }
    onSelect({ word, sentence: sentenceAround(text, word, offsets[i]), at: offsets[i] })
  }

  return (
    <span>
      {tokens.map((tok, i) => {
        if (!isWordToken(tok)) return <span key={i}>{tok}</span>
        const highlighted = selectMode && startIdx === i
        const active = activeAt === offsets[i]
        const saved = !!marked?.has(cleanWord(tok).toLowerCase())
        return (
          <span
            key={i}
            onClick={() => onWord(tok, i)}
            className={`-mx-0.5 cursor-pointer rounded-mark px-0.5 transition-colors ${
              highlighted
                ? 'bg-accent/28 ring-1 ring-accent-line'
                : active
                  ? 'bg-accent-soft ring-2 ring-focus'
                  : 'hover:bg-accent/18 active:bg-accent/28'
            } ${saved && !active ? 'underline decoration-accent decoration-dotted decoration-2 underline-offset-4' : ''}`}
          >
            {tok}
          </span>
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------------------// Шторка слова: то же содержимое, что панель перевода сбоку текста
// (WordDetails, макет d6), и кнопки внизу — «В мои слова», «Закрыть».
// ---------------------------------------------------------------------------

export function WordSheet({
  word,
  sentence,
  lang,
  onClose,
  onAdded,
}: {
  word: string
  sentence: string
  lang: AppLang
  onClose: () => void
  onAdded?: (front: string, back: string) => void
}) {
  const look = useWordLookup(word, sentence, lang, onAdded)
  const [analyze, setAnalyze] = useState(false)

  // Портал в body: внутри <main> любой предок с transform/filter «приватизирует»
  // fixed-позиционирование, и шторка уезжает за навигацию на длинных текстах.
  return (
    <>
      <Sheet onClose={onClose} maxH="85dvh" labelledBy="word-title">
        <SheetHeader
          id="word-title"
          title={
            <>
              {word.toLowerCase()}
              {look.baseDiffers && <span className="ml-2 text-base font-normal text-fg-muted">→ {look.ctx?.base}</span>}
            </>
          }
          trailing={
            <button onClick={look.playAudio} aria-label="Озвучить" className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <IconSpeaker size={18} />
            </button>
          }
        />
        <div className="min-h-0 overflow-y-auto px-5 pt-1">
          <WordFacts look={look} word={word} sentence={sentence} />
          {look.error && <ErrorText className="mt-3">{look.error}</ErrorText>}
          {/* Разбор всего предложения (фразовые глаголы/выражения/грамматика) */}
          <button
            type="button"
            onClick={() => setAnalyze(true)}
            className="mt-3 flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-strong"
          >
            <IconSearch size={16} /> Разбор предложения
          </button>
        </div>

        {/* Кнопки — всегда видны, не прячутся за навигацией */}
        <div className="flex shrink-0 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <AddWordButton look={look} className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </Sheet>
      {analyze && <AnalysisSheet text={sentence} sentence={sentence} lang={lang} onClose={() => setAnalyze(false)} />}
    </>
  )
}
