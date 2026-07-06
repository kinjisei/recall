// ============================================================================
// «Ввод» на испанском: тексты и диалоги из приложения spanish.
// Тап по слову → перевод (локальные паки → Gemini) → «в колоду».
// У каждого абзаца/реплики можно открыть русский перевод.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { addCard } from '../../lib/cards'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { lookupSpanish, type SpanishLookupResult } from '../../lib/spanishDict'
import {
  spanishDialogues,
  spanishLevels,
  spanishReadings,
} from '../../data/spanish'
import type { SpanishDialogue, SpanishReading } from '../../types'

type Kind = 'texts' | 'dialogues'

const kinds: { id: Kind; label: string }[] = [
  { id: 'texts', label: '📄 Тексты' },
  { id: 'dialogues', label: '🎭 Диалоги' },
]

export function SpanishReaderPage() {
  const [kind, setKind] = useState<Kind>('texts')
  const [level, setLevel] = useState<string>('A1')
  const [reading, setReading] = useState<SpanishReading | null>(null)
  const [dialogue, setDialogue] = useState<SpanishDialogue | null>(null)

  if (reading) {
    return <ReadingView reading={reading} onBack={() => setReading(null)} />
  }
  if (dialogue) {
    return <DialogueView dialogue={dialogue} onBack={() => setDialogue(null)} />
  }

  const readings = spanishReadings.filter((r) => r.level === level)
  const dialogues = spanishDialogues.filter((d) => d.level === level)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">📖 Ввод</h1>

      <div className="flex gap-2">
        {kinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              kind === k.id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {spanishLevels.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
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
        Выбери {kind === 'texts' ? 'текст' : 'диалог'} и нажимай на незнакомые
        слова — добавляй их в колоду.
      </p>

      <div className="flex flex-col gap-3">
        {kind === 'texts'
          ? readings.map((r) => (
              <button key={r.id} onClick={() => setReading(r)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{r.titleRu}</p>
                </Card>
              </button>
            ))
          : dialogues.map((d) => (
              <button key={d.id} onClick={() => setDialogue(d)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{d.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {d.lines.length} реплик
                  </p>
                </Card>
              </button>
            ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Текст: абзацы с тап-словами; у каждого абзаца — кнопка «перевод».
// ---------------------------------------------------------------------------

function ReadingView({
  reading,
  onBack,
}: {
  reading: SpanishReading
  onBack: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [openRu, setOpenRu] = useState<Set<number>>(new Set())

  const toggleRu = (i: number) =>
    setOpenRu((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Назад
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{reading.title}</h1>
          <p className="truncate text-sm text-slate-500">{reading.titleRu}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        {reading.paragraphs.map((p, i) => (
          <div key={i}>
            <p className="text-lg leading-relaxed">
              <TappableText text={p.es} onWord={setSelected} />
            </p>
            <button
              onClick={() => toggleRu(i)}
              className="mt-1 text-xs font-semibold text-sky-600 dark:text-sky-400"
            >
              {openRu.has(i) ? 'скрыть перевод' : '🇷🇺 перевод'}
            </button>
            {openRu.has(i) && (
              <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {p.ru}
              </p>
            )}
          </div>
        ))}
      </Card>

      {selected && (
        <SpanishWordSheet word={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Диалог: реплики со спикерами; перевод — кнопкой у каждой реплики.
// ---------------------------------------------------------------------------

function DialogueView({
  dialogue,
  onBack,
}: {
  dialogue: SpanishDialogue
  onBack: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showRu, setShowRu] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
            ← Назад
          </Button>
          <h1 className="truncate text-xl font-bold">{dialogue.title}</h1>
        </div>
        <Button
          variant="secondary"
          className="shrink-0 px-3 py-1.5 text-xs"
          onClick={() => setShowRu((s) => !s)}
        >
          {showRu ? 'Скрыть перевод' : '🇷🇺 Перевод'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {dialogue.lines.map((line, i) => (
          <Card key={i} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                  {line.speaker}
                </p>
                <p className="mt-0.5 leading-relaxed">
                  <TappableText text={line.es} onWord={setSelected} />
                </p>
                {showRu && (
                  <p className="mt-1 text-sm text-slate-500">{line.ru}</p>
                )}
              </div>
              <button
                onClick={() => speak(line.es, { lang: 'es' })}
                className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-base dark:bg-slate-700"
                aria-label="Озвучить реплику"
              >
                🔊
              </button>
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <SpanishWordSheet word={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Общее: разбивка испанского текста на тап-слова + карточка слова.
// ---------------------------------------------------------------------------

function TappableText({
  text,
  onWord,
}: {
  text: string
  onWord: (w: string) => void
}) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  return (
    <>
      {tokens.map((tok, i) => {
        const isWord = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(tok)
        if (!isWord) return <span key={i}>{tok}</span>
        return (
          <span
            key={i}
            onClick={() => onWord(tok)}
            className="cursor-pointer rounded px-0.5 hover:bg-sky-100 active:bg-sky-200 dark:hover:bg-sky-900/50"
          >
            {tok}
          </span>
        )
      })}
    </>
  )
}

function SpanishWordSheet({
  word,
  onClose,
}: {
  word: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<SpanishLookupResult | null>(null)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const shown = result?.word ?? word.toLowerCase().replace(/[^a-záéíóúüñ'-]/gi, '')

  useEffect(() => {
    setLoading(true)
    setAdded(false)
    lookupSpanish(word)
      .then(setResult)
      .finally(() => setLoading(false))
  }, [word])

  const addToDeck = async () => {
    setBusy(true)
    setAddError(null)
    try {
      await addCard({
        front: shown,
        back: result?.translation,
        example: result?.example,
        lang: 'es',
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
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white p-5 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{shown}</h3>
          <button
            onClick={() => speak(shown, { lang: 'es' })}
            className="rounded-full bg-slate-100 px-3 py-1 text-lg dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>

        {loading ? (
          <p className="mt-3 text-slate-500">Ищу перевод…</p>
        ) : result?.translation ? (
          <div className="mt-3">
            <p className="text-slate-700 dark:text-slate-200">{result.translation}</p>
            {result.example && (
              <p className="mt-2 text-sm italic text-slate-500">«{result.example}»</p>
            )}
            {result.exampleRu && (
              <p className="mt-1 text-xs text-slate-400">{result.exampleRu}</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-slate-500">
            Перевод не найден, но слово всё равно можно добавить в колоду.
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
