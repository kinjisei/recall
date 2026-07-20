import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { scoreEmoji } from '../../components/RoundResult'
import { Button } from '../../components/Button'
import { GuidedNext } from '../../components/GuidedNext'
import { MicrophoneIcon, SpeakerHighIcon } from '@phosphor-icons/react'
import { supabase } from '../../lib/supabase'
import { getDeckIds } from '../../lib/cards'
import { logActivity } from '../../lib/activity'
import { useLanguage } from '../../context/LanguageContext'
import { spanishSentences } from '../../data/spanish'
import { englishSentences } from '../../data/english'
import {
  speak,
  listen,
  isRecognitionSupported,
  scorePronunciation,
  type PronunciationScore,
} from '../../lib/speech'

/** Фраза для тренировки; hint — русский перевод. */
interface Phrase {
  text: string
  hint?: string
}

export function PronunciationPage() {
  const { lang } = useLanguage()
  const supported = isRecognitionSupported()
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [score, setScore] = useState<PronunciationScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Испанский: встроенные фразы (рус → исп).
  // Английский: встроенные фразы B1–C1 (с переводом) + фразы из карточек в конце.
  useEffect(() => {
    setIndex(0)
    setHeard(null)
    setScore(null)
    setError(null)

    if (lang === 'es') {
      setPhrases(spanishSentences.map((s) => ({ text: s.es, hint: s.ru })))
      return
    }

    const builtIn = englishSentences.map((s) => ({ text: s.en, hint: s.ru }))
    setPhrases(builtIn)
    void (async () => {
      try {
        const ids = await getDeckIds('en')
        if (ids.length === 0) return
        const { data } = await supabase
          .from('cards')
          .select('front, example')
          .in('deck_id', ids)
        const fromCards = (data ?? [])
          .map((c) => (c.example && c.example.trim() ? c.example : c.front))
          .filter((p): p is string => Boolean(p && /\s/.test(p))) // только фразы (с пробелом)
        if (fromCards.length > 0) {
          setPhrases([...builtIn, ...fromCards.map((text) => ({ text }))])
        }
      } catch {
        /* остаёмся на встроенных фразах */
      }
    })()
  }, [lang])

  const current = phrases[index]

  const onListen = async () => {
    if (!current) return
    setError(null)
    setHeard(null)
    setScore(null)
    setListening(true)
    try {
      const { transcript } = await listen(lang)
      setHeard(transcript)
      setScore(scorePronunciation(current.text, transcript))
      void logActivity('pronunciation')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setListening(false)
    }
  }

  const next = () => {
    setHeard(null)
    setScore(null)
    setError(null)
    setIndex((i) => (i + 1) % Math.max(phrases.length, 1))
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">🎙 Речь</h1>
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">🎙 Речь</h1>

      {!supported && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Распознавание речи работает только в <b>Chrome</b> или <b>Edge</b>.
            Озвучку послушать можно, но оценить повтор — нет.
          </p>
        </Card>
      )}

      <p className="text-sm text-[var(--night-text-40)]">
        Послушай фразу, затем повтори её вслух — приложение оценит, насколько точно.
      </p>

      <Card className="min-h-[120px] items-center justify-center text-center">
        <p className="text-xl font-medium leading-relaxed">
          {score ? (
            score.words.map((w, i) => (
              <span
                key={i}
                className={
                  w.ok
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500'
                }
              >
                {w.word}{' '}
              </span>
            ))
          ) : (
            <span>{current.text}</span>
          )}
        </p>
        {current.hint && !score && (
          <p className="mt-2 text-sm text-[var(--night-text-40)]">{current.hint}</p>
        )}
      </Card>

      {/* чип «Прослушать» + крупный микрофон, который пульсирует при записи */}
      <div className="flex flex-col items-center gap-5 pt-1">
        <button
          onClick={() => speak(current.text, { lang })}
          className="lift flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.10] px-5 text-sm text-[var(--night-text-70)]"
        >
          <SpeakerHighIcon size={16} /> Прослушать
        </button>

        <button
          onClick={onListen}
          disabled={!supported || listening}
          aria-label={listening ? 'Слушаю…' : 'Повторить вслух'}
          className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
            listening
              ? 'animate-pulse-ring bg-[var(--night-accent)] text-white'
              : 'lift bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
          }`}
        >
          <MicrophoneIcon size={32} weight="fill" />
        </button>
        <p className="text-xs text-[var(--night-text-40)]">
          {listening ? 'Слушаю — говори' : 'Нажми и повтори фразу вслух'}
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {score && (
        <Card className="text-center">
          <p className="text-4xl font-bold">
            {score.percent}%
            <span className="ml-2">
              {scoreEmoji(score.percent)}
            </span>
          </p>
          {heard && (
            <p className="mt-2 text-sm text-[var(--night-text-40)]">Услышано: «{heard}»</p>
          )}
          <p className="mt-1 text-xs text-[var(--night-text-40)]">
            Зелёные слова распознаны верно, красные — стоит повторить.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--night-text-40)]">
          {index + 1} / {phrases.length}
        </span>
        <Button variant="ghost" onClick={next}>
          Дальше →
        </Button>
      </div>

      {/* ведомая сессия: речь — последний шаг, покажем поздравление */}
      {score && <GuidedNext step="pronunciation" />}
    </div>
  )
}
