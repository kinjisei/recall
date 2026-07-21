// ============================================================================
// Общая словарная шторка для всех читалок (Ввод EN/ES, Задания):
// перевод слова В КОНТЕКСТЕ предложения (Gemini) + транскрипция/аудио (EN,
// Free Dictionary) + «в колоду». Плюс TappableText — кликабельные слова.
//
// Шторка выше нижней навигации (z-50), контент прокручивается, кнопки всегда
// видны (safe-area учтён).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconSpeaker } from './icons'
import { Button } from './Button'
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

/** Предложение, в котором встречается слово (для контекстного перевода). */
export function sentenceAround(text: string, word: string): string {
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const found = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))
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
}: {
  text: string
  onSelect: (pick: WordPick) => void
}) {
  const tokens = useMemo(() => text.split(/([\s—–…]+)/), [text])
  // индексы токенов-слов, которые входят в выделяемую фразу
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const longPress = useRef<number | null>(null)

  const isWordToken = (tok: string) => /[A-Za-zÀ-ÿ]/.test(tok)

  /** Собирает фразу из выделенного диапазона токенов. */
  const phraseOf = (from: number, to: number) => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    return tokens
      .slice(a, b + 1)
      .join('')
      .trim()
      .replace(/\s+/g, ' ')
  }

  const cancelLongPress = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current)
      longPress.current = null
    }
  }

  const finishSelection = () => {
    cancelLongPress()
    if (!selecting || !range) {
      setSelecting(false)
      setRange(null)
      return
    }
    const phrase = phraseOf(range.from, range.to)
    const cleaned = phrase.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ'’-]+$/g, '')
    setSelecting(false)
    setRange(null)
    if (cleaned) onSelect({ word: cleaned, sentence: sentenceAround(text, cleaned) })
  }

  const inRange = (i: number) =>
    range !== null && i >= Math.min(range.from, range.to) && i <= Math.max(range.from, range.to)

  return (
    <span
      onPointerUp={finishSelection}
      onPointerLeave={() => selecting && finishSelection()}
      className={selecting ? 'select-none' : undefined}
    >
      {tokens.map((tok, i) => {
        if (!isWordToken(tok)) {
          // пробелы внутри выделения тоже подсвечиваем — фраза выглядит цельной
          return (
            <span key={i} className={inRange(i) ? 'bg-[rgba(145,132,217,.28)]' : undefined}>
              {tok}
            </span>
          )
        }
        const highlighted = inRange(i)
        return (
          <span
            key={i}
            onPointerDown={() => {
              cancelLongPress()
              // удержание ~350 мс — включаем режим выделения фразы
              longPress.current = window.setTimeout(() => {
                setSelecting(true)
                setRange({ from: i, to: i })
              }, 350)
            }}
            onPointerEnter={() => {
              if (selecting) setRange((r) => (r ? { ...r, to: i } : { from: i, to: i }))
            }}
            onPointerUp={(e) => {
              // обычный тап (без удержания) — перевод одного слова
              if (!selecting) {
                e.stopPropagation()
                cancelLongPress()
                const word = cleanWord(tok)
                if (word) onSelect({ word, sentence: sentenceAround(text, word) })
              }
            }}
            className={`cursor-pointer rounded px-0.5 transition-colors ${
              highlighted
                ? 'bg-[rgba(145,132,217,.28)]'
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
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />

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
              className="shrink-0 rounded-full bg-white/[0.06] px-3 py-2 dark:bg-white/[0.08]"
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
              Перевод сейчас недоступен — слово всё равно можно добавить в колоду.
            </p>
          )}

          <p className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-sm italic text-[var(--night-text-40)] dark:bg-slate-700/60 dark:text-[var(--night-text-40)]">
            «{sentence}»
          </p>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>

        {/* Кнопки — всегда видны, не прячутся за навигацией */}
        <div className="flex shrink-0 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
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
    </div>,
    document.body,
  )
}
