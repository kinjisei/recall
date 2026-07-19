// ============================================================================
// Общая словарная шторка для всех читалок (Ввод EN/ES, Задания):
// перевод слова В КОНТЕКСТЕ предложения (Gemini) + транскрипция/аудио (EN,
// Free Dictionary) + «в колоду». Плюс TappableText — кликабельные слова.
//
// Шторка выше нижней навигации (z-50), контент прокручивается, кнопки всегда
// видны (safe-area учтён).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
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
 */
export function TappableText({
  text,
  onSelect,
}: {
  text: string
  onSelect: (pick: WordPick) => void
}) {
  const tokens = useMemo(() => text.split(/([\s—–…]+)/), [text])
  return (
    <>
      {tokens.map((tok, i) => {
        const isWord = /[A-Za-zÀ-ÿ]/.test(tok)
        if (!isWord) return <span key={i}>{tok}</span>
        return (
          <span
            key={i}
            onClick={() => {
              const word = cleanWord(tok)
              if (word) onSelect({ word, sentence: sentenceAround(text, word) })
            }}
            className="cursor-pointer rounded px-0.5 hover:bg-sky-100 active:bg-sky-200 dark:hover:bg-sky-900/50"
          >
            {tok}
          </span>
        )
      })}
    </>
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

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />

        {/* Прокручиваемое содержимое */}
        <div className="min-h-0 overflow-y-auto px-5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 text-xl font-bold">
              {word.toLowerCase()}
              {baseDiffers && (
                <span className="ml-2 text-base font-normal text-slate-400">
                  → {ctx.base}
                </span>
              )}
            </h3>
            <button
              onClick={playAudio}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-lg dark:bg-slate-700"
              aria-label="Озвучить"
            >
              🔊
            </button>
          </div>

          {ipa && <p className="mt-1 text-slate-400">/{ipa}/</p>}

          {!ctx && !ctxError && (
            <p className="mt-3 text-slate-500">Перевожу в контексте…</p>
          )}
          {ctx && (
            <div className="mt-3">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {ctx.translation}
              </p>
              {ctx.note && (
                <p className="mt-1 text-sm text-slate-500">💡 {ctx.note}</p>
              )}
            </div>
          )}
          {ctxError && (
            <p className="mt-3 text-slate-500">
              Перевод сейчас недоступен — слово всё равно можно добавить в колоду.
            </p>
          )}

          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm italic text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
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
    </div>
  )
}
