import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { addCard } from '../../lib/cards'
import { logActivity } from '../../lib/activity'
import { lookup, type DictionaryResult } from '../../lib/dictionary'
import { useLanguage } from '../../context/LanguageContext'
import { SpanishReaderPage } from './SpanishReader'
import { sampleTexts, type SampleText } from './sampleTexts'
import type { CEFRLevel } from '../../types'

const levels: CEFRLevel[] = ['B1', 'C1']

/** «Ввод»: английский — тексты + словарь; испанский — свой раздел. */
export function ReaderPage() {
  const { lang } = useLanguage()
  if (lang === 'es') return <SpanishReaderPage />
  return <EnglishReaderPage />
}

function EnglishReaderPage() {
  const [level, setLevel] = useState<CEFRLevel>('B1')
  const [active, setActive] = useState<SampleText | null>(null)

  const texts = sampleTexts.filter((t) => t.level === level)

  if (active) {
    return <Reader text={active} onBack={() => setActive(null)} />
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">📖 Ввод</h1>

      <div className="flex gap-2">
        {levels.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              level === l
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        Выбери текст и нажимай на незнакомые слова — добавляй их в колоду.
      </p>

      <div className="flex flex-col gap-3">
        {texts.map((t) => (
          <button key={t.id} onClick={() => setActive(t)} className="text-left">
            <Card className="transition-transform active:scale-[0.99]">
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{t.body}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

function Reader({ text, onBack }: { text: SampleText; onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  // Разбиваем текст на слова и разделители, сохраняя пробелы/пунктуацию.
  const tokens = useMemo(() => text.body.split(/(\s+)/), [text.body])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Назад
        </Button>
        <h1 className="text-xl font-bold">{text.title}</h1>
      </div>

      <Card>
        <p className="text-lg leading-relaxed">
          {tokens.map((tok, i) => {
            const isWord = /[A-Za-z]/.test(tok)
            if (!isWord) return <span key={i}>{tok}</span>
            return (
              <span
                key={i}
                onClick={() => setSelected(tok)}
                className="cursor-pointer rounded px-0.5 hover:bg-sky-100 active:bg-sky-200 dark:hover:bg-sky-900/50"
              >
                {tok}
              </span>
            )
          })}
        </p>
      </Card>

      {selected && (
        <WordSheet word={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function WordSheet({ word, onClose }: { word: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<DictionaryResult | null>(null)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Загружаем словарную статью при открытии (и при смене слова).
  useEffect(() => {
    setLoading(true)
    setAdded(false)
    lookup(word)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [word])

  const playAudio = () => {
    if (result?.audio_url) {
      new Audio(result.audio_url).play().catch(() => speak(word))
    } else {
      speak(word)
    }
  }

  const addToDeck = async () => {
    setBusy(true)
    setAddError(null)
    try {
      await addCard({
        front: result?.word ?? word.toLowerCase(),
        back: result?.definition,
        example: result?.example,
        ipa: result?.ipa,
        audio_url: result?.audio_url,
        source: 'reader',
      })
      void logActivity('reader')
      setAdded(true)
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Не удалось добавить слово')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl bg-white p-5 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{result?.word ?? word.toLowerCase()}</h3>
          <button
            onClick={playAudio}
            className="rounded-full bg-slate-100 px-3 py-1 text-lg dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>

        {result?.ipa && <p className="mt-1 text-slate-400">/{result.ipa}/</p>}

        {loading ? (
          <p className="mt-3 text-slate-500">Ищу в словаре…</p>
        ) : result?.definition ? (
          <div className="mt-3">
            <p className="text-slate-700 dark:text-slate-200">{result.definition}</p>
            {result.example && (
              <p className="mt-2 text-sm italic text-slate-500">«{result.example}»</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-slate-500">
            Определение не найдено, но слово всё равно можно добавить в колоду.
          </p>
        )}

        {addError && <p className="mt-3 text-sm text-red-500">{addError}</p>}

        <div className="mt-5 flex gap-3">
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

/** Простая озвучка через браузер, если у слова нет аудио-файла. */
function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    window.speechSynthesis.speak(u)
  } catch {
    /* в некоторых браузерах недоступно — не критично */
  }
}
