import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult } from '../../components/RoundResult'
import { GuidedNext } from '../../components/GuidedNext'
import { celebrate } from '../../components/Confetti'
import {
  IconMic,
  IconStop,
  IconSpinner,
  IconSpeaker,
  IconSpeakerSlow,
  IconBadgeCheck,
  IconHeadphones,
  IconRefresh,
} from '../../components/icons'
import { supabase } from '../../lib/supabase'
import { getDeckIds } from '../../lib/cards'
import { getUserLevel } from '../../lib/level'
import { logActivity } from '../../lib/activity'
import { shuffle } from '../../lib/random'
import { useLanguage } from '../../context/LanguageContext'
import { spanishSentences } from '../../data/spanish'
import { englishSentences } from '../../data/english'
import { speak, scorePronunciation, type PronunciationScore } from '../../lib/speech'
import { startRecording, transcribe, isMicSupported, type Recorder } from '../../lib/transcribe'
import type { AppLang } from '../../types'

/** Фраза для тренировки; hint — русский перевод, level — уровень CEFR. */
interface Phrase {
  text: string
  hint?: string
  level?: string
}

const ROUND = 10 // фраз в одном раунде
const PASS = 60 // с какого % фраза считается «произнесена»
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Скорость «медленной» озвучки для шэдоуинга. */
const SLOW_RATE = 0.6

/**
 * Собирает и перемешивает пул фраз под уровень ученика.
 * Берём фразы своего уровня и ниже; если их меньше, чем на раунд —
 * подключаем все (лучше «трудноватая» фраза, чем пустой экран).
 * Английские фразы из карточек пользователя (уровня нет) идут всегда.
 */
function buildPool(lang: AppLang, level: string | null, cardPhrases: string[]): Phrase[] {
  const base: Phrase[] =
    lang === 'es'
      ? spanishSentences.map((s) => ({ text: s.es, hint: s.ru, level: s.level }))
      : englishSentences.map((s) => ({ text: s.en, hint: s.ru, level: s.level }))

  let picked = base
  const t = level ? LEVELS.indexOf(level) : -1
  if (t >= 0) {
    const atOrBelow = base.filter((p) => {
      const i = LEVELS.indexOf(p.level ?? '')
      return i < 0 || i <= t
    })
    if (atOrBelow.length >= ROUND) picked = atOrBelow
  }

  const cards: Phrase[] = cardPhrases.map((text) => ({ text }))
  return shuffle([...picked, ...cards])
}

/** Человеческая подсказка по результату вместо «зелёные/красные слова». */
function humanHint(score: PronunciationScore): string {
  if (score.percent === 100) return 'Идеально! Все слова на месте.'
  const missed = score.words.filter((w) => !w.ok).map((w) => w.word)
  const list = missed.slice(0, 4).map((w) => `«${w}»`).join(', ')
  const tail = missed.length > 4 ? '…' : ''
  if (missed.length <= 2) return `Почти идеально. Обрати внимание на ${list}.`
  return `Ещё потренируйся — недоставало: ${list}${tail}.`
}

/** Автостоп записи, если человек забыл нажать «Стоп» (фраза — несколько секунд). */
const MAX_RECORD_MS = 12_000

export function PronunciationPage() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const supported = isMicSupported() // запись микрофона есть и на iPhone

  const [pool, setPool] = useState<Phrase[]>([])
  const [round, setRound] = useState<Phrase[]>([])
  const [index, setIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [score, setScore] = useState<PronunciationScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<number[]>([]) // % за каждую фразу раунда
  const [done, setDone] = useState(false)

  const recorderRef = useRef<Recorder | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Сброс и загрузка пула под язык/уровень.
  useEffect(() => {
    let alive = true
    setIndex(0)
    setHeard(null)
    setScore(null)
    setError(null)
    setResults([])
    setDone(false)

    void (async () => {
      const level = await getUserLevel(lang).catch(() => null)
      let cardPhrases: string[] = []
      if (lang === 'en') {
        try {
          const ids = await getDeckIds('en')
          if (ids.length > 0) {
            const { data } = await supabase
              .from('cards')
              .select('front, example')
              .in('deck_id', ids)
              .limit(50) // не тянем всю колоду — на раунд хватит
            cardPhrases = (data ?? [])
              .map((c) => (c.example && c.example.trim() ? c.example : c.front))
              .filter((p): p is string => Boolean(p && /\s/.test(p)))
          }
        } catch {
          /* остаёмся на встроенных фразах */
        }
      }
      if (!alive) return
      const p = buildPool(lang, level, cardPhrases)
      setPool(p)
      setRound(p.slice(0, ROUND))
    })()

    return () => {
      alive = false
    }
  }, [lang])

  const current = round[index]

  // Финал раунда → празднование.
  useEffect(() => {
    if (done) celebrate()
  }, [done])

  // освобождаем микрофон при уходе с экрана
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current)
      recorderRef.current?.cancel()
    }
  }, [])

  /** Останавливает запись, распознаёт через Groq и считает совпадение слов. */
  const finishRecording = async () => {
    const rec = recorderRef.current
    if (!rec) return
    recorderRef.current = null
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    setRecording(false)
    setProcessing(true)
    try {
      const blob = await rec.stop()
      const transcript = await transcribe(blob, lang)
      if (!transcript) {
        setError('Не расслышал. Скажи чуть громче и чётче.')
        return
      }
      setHeard(transcript)
      setScore(scorePronunciation(current!.text, transcript))
      void logActivity('pronunciation')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка распознавания')
    } finally {
      setProcessing(false)
    }
  }

  /** Тап по микрофону: начать запись или остановить и оценить. */
  const onMic = async () => {
    if (processing) return
    if (recording) {
      void finishRecording()
      return
    }
    setError(null)
    setHeard(null)
    setScore(null)
    try {
      recorderRef.current = await startRecording()
      setRecording(true)
      autoStopRef.current = setTimeout(() => void finishRecording(), MAX_RECORD_MS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось начать запись')
    }
  }

  const advance = () => {
    // зафиксировать результат фразы (0, если не записывал — в режиме оценки)
    const next = [...results, supported ? (score?.percent ?? 0) : 100]
    setResults(next)
    setHeard(null)
    setScore(null)
    setError(null)
    if (!supported) void logActivity('pronunciation') // в режиме «слушай-повторяй» тоже засчитываем
    if (index + 1 >= round.length) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  const retryPhrase = () => {
    setHeard(null)
    setScore(null)
    setError(null)
  }

  const restart = () => {
    const reshuffled = shuffle(pool)
    setPool(reshuffled)
    setRound(reshuffled.slice(0, ROUND))
    setIndex(0)
    setResults([])
    setHeard(null)
    setScore(null)
    setError(null)
    setDone(false)
  }

  // ---- Экран загрузки ----
  if (!current && !done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate('/practice')} label="К практике" />
          <h1 className="text-2xl font-medium tracking-tight">Речь</h1>
        </div>
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      </div>
    )
  }

  // ---- Финал раунда ----
  if (done) {
    const passed = results.filter((p) => p >= PASS).length
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate('/practice')} label="К практике" />
          <h1 className="text-2xl font-medium tracking-tight">Речь</h1>
        </div>
        {supported ? (
          <RoundResult
            correct={passed}
            total={round.length}
            note="Раунд засчитан в серию дня."
            onRestart={restart}
          />
        ) : (
          <Card className="flex flex-col items-center gap-3 text-center">
            <IconHeadphones size={40} className="text-[var(--night-accent-text)]" />
            <p className="text-lg font-bold">Раунд пройден</p>
            <p className="text-sm text-[var(--night-text-40)]">
              Ты повторил {round.length} фраз вслух — так держать!
            </p>
            <Button className="mt-1" onClick={restart}>
              Ещё раунд
            </Button>
          </Card>
        )}
        <GuidedNext step="pronunciation" />
      </div>
    )
  }

  // ---- Основной экран ----
  // Раскладка «действие к низу»: заголовок и карточка фразы сверху, микрофон и
  // кнопки прижаты к низу экрана (flex-1 распорка между ними) — как в макете.
  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <BackButton onClick={() => navigate('/practice')} label="К практике" />
          <h1 className="text-2xl font-medium tracking-tight">Речь</h1>
        </div>
        <span className="text-sm text-[var(--night-text-40)]">
          фраза {index + 1} / {round.length}
        </span>
      </div>

      {/* Карточка фразы: чипы озвучки внутри, слова — тапабельные */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => speak(current.text, { lang })}
            className="lift flex min-h-[40px] items-center gap-2 rounded-full border border-white/[0.10] px-4 text-sm text-[var(--night-text-70)]"
          >
            <IconSpeaker size={16} /> Прослушать
          </button>
          <button
            onClick={() => speak(current.text, { lang, rate: SLOW_RATE })}
            className="lift flex min-h-[40px] items-center gap-2 rounded-full border border-white/[0.10] px-4 text-sm text-[var(--night-text-70)]"
          >
            <IconSpeakerSlow size={16} /> Медленно
          </button>
        </div>

        <p className="text-xl font-medium leading-relaxed">
          {(score ? score.words : current.text.split(/\s+/).map((word) => ({ word, ok: null }))).map(
            (w, i) => (
              <span key={i}>
                <button
                  onClick={() => speak(w.word.replace(/[^\p{L}\p{N}'-]/gu, ''), { lang })}
                  title="Послушать слово"
                  className={
                    'inline align-baseline transition-colors ' +
                    (w.ok === true
                      ? 'text-emerald-400'
                      : w.ok === false
                        ? 'text-red-400'
                        : 'hover:text-[var(--night-accent-text)]')
                  }
                >
                  {w.word}
                </button>{' '}
              </span>
            ),
          )}
        </p>

        {current.hint && !score && (
          <p className="text-sm text-[var(--night-text-40)]">{current.hint}</p>
        )}
      </Card>

      {/* Оценка результата */}
      {score && (
        <Card className="flex items-center gap-3">
          <IconBadgeCheck
            size={36}
            className={score.percent >= PASS ? 'text-[var(--night-accent)]' : 'text-[var(--night-text-25)]'}
          />
          <div className="min-w-0">
            <p className="font-bold">
              Совпадение — {score.percent}%
            </p>
            <p className="text-sm text-[var(--night-text-60)]">{humanHint(score)}</p>
            {heard && (
              <p className="mt-1 text-xs text-[var(--night-text-40)]">Услышано: «{heard}»</p>
            )}
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* распорка: прижимает микрофон и кнопки к низу экрана */}
      <div className="flex-1" />

      {/* Микрофон: тап — запись, ещё тап — стоп и оценка (работает и на iPhone) */}
      {supported ? (
        <div className="flex flex-col items-center gap-4 pt-1">
          <div className="relative flex items-center justify-center">
            {/* мягкий ореол */}
            <span
              aria-hidden
              className="absolute h-24 w-24 rounded-full bg-[var(--night-accent)] opacity-20 blur-xl"
            />
            <button
              onClick={onMic}
              disabled={processing}
              aria-label={recording ? 'Остановить и оценить' : 'Записать произношение'}
              style={{
                background:
                  'linear-gradient(160deg, var(--night-accent) 0%, var(--night-accent-900) 100%)',
              }}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg disabled:opacity-70 ${
                recording ? 'animate-pulse-ring' : 'lift'
              }`}
            >
              {processing ? (
                <IconSpinner size={32} className="animate-spin" />
              ) : recording ? (
                <IconStop size={30} />
              ) : (
                <IconMic size={34} />
              )}
            </button>
          </div>
          <p className="text-xs text-[var(--night-text-40)]">
            {processing
              ? 'Распознаю…'
              : recording
                ? 'Говори фразу и нажми, когда закончишь'
                : 'Нажми, скажи фразу вслух'}
          </p>
        </div>
      ) : (
        // Совсем нет микрофона — режим «слушай и повторяй» без оценки
        <Card className="border-[var(--night-accent-30)]">
          <p className="text-sm text-[var(--night-text-70)]">
            На этом устройстве нет доступа к микрофону. Послушай эталон (в т.ч.
            «Медленно») и повтори вслух за диктором — это главная тренировка.
          </p>
        </Card>
      )}

      {/* Навигация по раунду: до записи кнопок нет (только микрофон) — «Дальше»
          появляется после оценки. В режиме без микрофона (iPhone) «Дальше»
          нужен всегда, иначе фразы не пролистать. */}
      {(score || !supported) && (
        <div className="flex items-center justify-between gap-3">
          {score ? (
            <Button variant="secondary" onClick={retryPhrase}>
              <IconRefresh size={18} className="mr-1 inline" />
              Повторить
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={advance}>
            {index + 1 >= round.length ? 'Завершить раунд' : 'Дальше →'}
          </Button>
        </div>
      )}
    </div>
  )
}
