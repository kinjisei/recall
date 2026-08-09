// ============================================================================
// Общая словарная шторка для всех читалок (Ввод EN/ES, Задания):
// перевод слова В КОНТЕКСТЕ предложения (Gemini) + транскрипция/аудио (EN,
// Free Dictionary) + «в мои слова». Плюс TappableText — кликабельные слова.
//
// Шторка выше нижней навигации (z-50), контент прокручивается, кнопки всегда
// видны (safe-area учтён).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconSearch, IconSpeaker } from './icons'
import { Button } from './Button'
import { AnalysisSheet } from './AnalysisSheet'
import { addCard } from '../lib/cards'
import { lookup } from '../lib/dictionary'
import { lookupInContext, type ContextLookup } from '../lib/contextDict'
import { logActivity } from '../lib/activity'
import { speak } from '../lib/speech'
import type { AppLang } from '../types'

/** Выбранное слово + предложение, в котором оно встретилось. */
export interface WordPick {
  word: string
  sentence: string
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
}: {
  text: string
  onSelect: (pick: WordPick) => void
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
    onSelect({ word, sentence: sentenceAround(text, word, offsets[i]) })
  }

  return (
    <span>
      {tokens.map((tok, i) => {
        if (!isWordToken(tok)) return <span key={i}>{tok}</span>
        const highlighted = selectMode && startIdx === i
        return (
          <span
            key={i}
            onClick={() => onWord(tok, i)}
            className={`cursor-pointer rounded px-0.5 transition-colors ${
              highlighted
                ? 'bg-[rgba(145,132,217,.28)] ring-1 ring-[var(--night-accent-45)]'
                : 'hover:bg-[rgba(145,132,217,.18)] active:bg-[rgba(145,132,217,.28)]'
            }`}
          >
            {tok}
          </span>
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Шторка слова.
// ---------------------------------------------------------------------------

export function WordSheet({
  word,
  sentence,
  lang,
  onClose,
}: {
  word: string
  sentence: string
  lang: AppLang
  onClose: () => void
}) {
  const [ctx, setCtx] = useState<ContextLookup | null>(null)
  const [ctxError, setCtxError] = useState(false)
  const [ipa, setIpa] = useState<string | undefined>()
  const [audioUrl, setAudioUrl] = useState<string | undefined>()
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // разбор ВСЕГО предложения (умная модель) — вместо выделения фразы пальцем
  const [analyze, setAnalyze] = useState(false)

  // Контекстный перевод (Gemini) и — для английского — транскрипция/аудио.
  // alive-флаг: при быстрой смене слова медленный ответ по прошлому слову
  // не должен перезаписать данные актуального.
  useEffect(() => {
    let alive = true
    setCtx(null)
    setCtxError(false)
    setAdded(false)
    setError(null)
    setIpa(undefined)
    setAudioUrl(undefined)

    lookupInContext(word, sentence, lang)
      .then((r) => alive && setCtx(r))
      .catch(() => alive && setCtxError(true))

    if (lang === 'en') {
      lookup(word)
        .then((r) => {
          if (alive && r) {
            setIpa(r.ipa)
            setAudioUrl(r.audio_url)
          }
        })
        .catch(() => {})
    }

    return () => {
      alive = false
    }
  }, [word, sentence, lang])

  const playAudio = () => {
    if (audioUrl) {
      new Audio(audioUrl).play().catch(() => speak(word, { lang }))
    } else {
      speak(word, { lang })
    }
  }

  const addToDeck = async () => {
    setBusy(true)
    setError(null)
    try {
      await addCard({
        front: ctx?.base ?? word.toLowerCase(),
        back: ctx
          ? ctx.translation + (ctx.note ? ` · ${ctx.note}` : '')
          : undefined,
        example: sentence,
        ipa,
        audio_url: audioUrl,
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

  const baseDiffers =
    ctx && ctx.base.toLowerCase() !== word.toLowerCase().replace(/[’]/g, "'")

  // Портал в body: внутри <main> любой предок с transform/filter «приватизирует»
  // fixed-позиционирование, и шторка уезжает за навигацию на длинных текстах.
  return createPortal(
    <>
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />

        {/* Прокручиваемое содержимое */}
        <div className="min-h-0 overflow-y-auto px-5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 text-xl font-bold">
              {word.toLowerCase()}
              {baseDiffers && (
                <span className="ml-2 text-base font-normal text-[var(--night-text-40)]">
                  → {ctx.base}
                </span>
              )}
            </h3>
            <button
              onClick={playAudio}
              className="shrink-0 rounded-full bg-white/[0.08] px-3 py-2"
              aria-label="Озвучить"
            >
              <IconSpeaker size={18} />
            </button>
          </div>

          {ipa && <p className="mt-1 text-[var(--night-text-40)]">/{ipa}/</p>}

          {!ctx && !ctxError && (
            <p className="mt-3 text-[var(--night-text-40)]">Перевожу в контексте…</p>
          )}
          {ctx && (
            <div className="mt-3">
              <p className="text-lg font-semibold text-[var(--night-text)]">
                {ctx.translation}
              </p>
              {ctx.note && (
                <p className="mt-1 text-sm text-[var(--night-text-40)]">{ctx.note}</p>
              )}
            </div>
          )}
          {ctxError && (
            <p className="mt-3 text-[var(--night-text-40)]">
              Перевод сейчас недоступен — слово всё равно можно добавить в мои слова.
            </p>
          )}

          <p className="mt-3 rounded-lg bg-slate-700/60 px-3 py-2 text-sm italic text-[var(--night-text-40)]">
            «{sentence}»
          </p>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          {/* Разбор всего предложения (фразовые глаголы/выражения/грамматика) */}
          <button
            onClick={() => setAnalyze(true)}
            className="lift mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.10)] py-2.5 text-sm font-medium text-[var(--night-accent-100)]"
          >
            <IconSearch size={16} /> Разбор предложения
          </button>
        </div>

        {/* Кнопки — всегда видны, не прячутся за навигацией */}
        <div className="flex shrink-0 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {added ? (
            <Button variant="secondary" className="flex-1" disabled>
              Добавлено ✓
            </Button>
          ) : (
            <Button className="flex-1" onClick={addToDeck} disabled={busy}>
              {busy ? 'Добавляю…' : '+ В мои слова'}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
    {analyze && (
      <AnalysisSheet
        text={sentence}
        sentence={sentence}
        lang={lang}
        onClose={() => setAnalyze(false)}
      />
    )}
    </>,
    document.body,
  )
}
