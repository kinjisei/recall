// ============================================================================
// «Ввод» на испанском: тексты и диалоги из приложения spanish.
// Тап по слову → контекстный перевод (общая шторка WordSheet) → «в колоду».
// У каждого абзаца/реплики можно открыть русский перевод.
// ============================================================================
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { speak } from '../../lib/speech'
import { TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
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
  const [selected, setSelected] = useState<WordPick | null>(null)
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
              <TappableText text={p.es} onSelect={setSelected} />
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
        <WordSheet word={selected.word} sentence={selected.sentence} lang="es" onClose={() => setSelected(null)} />
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
  const [selected, setSelected] = useState<WordPick | null>(null)
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
                  <TappableText text={line.es} onSelect={setSelected} />
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
        <WordSheet word={selected.word} sentence={selected.sentence} lang="es" onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Общее: разбивка испанского текста на тап-слова + карточка слова.
// ---------------------------------------------------------------------------
