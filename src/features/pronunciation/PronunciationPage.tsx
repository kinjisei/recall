import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import {
  speak,
  listen,
  isRecognitionSupported,
  scorePronunciation,
  type PronunciationScore,
} from '../../lib/speech'

const fallbackPhrases = [
  'The weather is really lovely today.',
  'Could you tell me how to get to the station?',
  "I've been learning English for several years.",
  'She decided to take a completely different approach.',
  'Practising a little every day leads to real progress.',
]

export function PronunciationPage() {
  const supported = isRecognitionSupported()
  const [phrases, setPhrases] = useState<string[]>(fallbackPhrases)
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [score, setScore] = useState<PronunciationScore | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Берём фразы из карточек пользователя (пример или само слово), иначе — встроенные.
  useEffect(() => {
    supabase
      .from('cards')
      .select('front, example')
      .then(({ data }) => {
        const fromCards = (data ?? [])
          .map((c) => (c.example && c.example.trim() ? c.example : c.front))
          .filter((p): p is string => Boolean(p && /\s/.test(p))) // только фразы (с пробелом)
        if (fromCards.length > 0) setPhrases(fromCards)
      })
  }, [])

  const current = phrases[index]

  const onListen = async () => {
    setError(null)
    setHeard(null)
    setScore(null)
    setListening(true)
    try {
      const { transcript } = await listen()
      setHeard(transcript)
      setScore(scorePronunciation(current, transcript))
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
    setIndex((i) => (i + 1) % phrases.length)
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

      <p className="text-sm text-slate-500">
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
            <span>{current}</span>
          )}
        </p>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => speak(current)}
        >
          🔊 Слушать
        </Button>
        <Button
          className="flex-1"
          onClick={onListen}
          disabled={!supported || listening}
        >
          {listening ? '🎤 Слушаю…' : '🎤 Повторить'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {score && (
        <Card className="text-center">
          <p className="text-4xl font-bold">
            {score.percent}%
            <span className="ml-2">
              {score.percent >= 80 ? '🎉' : score.percent >= 50 ? '👍' : '💪'}
            </span>
          </p>
          {heard && (
            <p className="mt-2 text-sm text-slate-500">Услышано: «{heard}»</p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            Зелёные слова распознаны верно, красные — стоит повторить.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {index + 1} / {phrases.length}
        </span>
        <Button variant="ghost" onClick={next}>
          Дальше →
        </Button>
      </div>
    </div>
  )
}
