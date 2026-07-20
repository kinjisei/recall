// ============================================================================
// «Ввод» на испанском: тексты и диалоги из приложения spanish.
// Тап по слову → контекстный перевод (общая шторка WordSheet) → «в колоду».
// У каждого абзаца/реплики можно открыть русский перевод.
// ============================================================================
import { useState, type ReactNode } from 'react'
import {
  ChatsCircleIcon,
  FileTextIcon,
  SpeakerHighIcon,
  TranslateIcon,
  type Icon,
} from '@phosphor-icons/react'
import { getSettings, READER_CLASSES } from '../../lib/settings'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { BackButton, BackHeader } from '../../components/BackButton'
import { speak } from '../../lib/speech'
import { TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
import {
  spanishDialogues,
  spanishLevels,
  spanishReadings,
} from '../../data/spanish'
import type { SpanishDialogue, SpanishReading } from '../../types'

type Kind = 'texts' | 'dialogues'

const kinds: { id: Kind; label: string; Icon: Icon }[] = [
  { id: 'texts', label: 'Тексты', Icon: FileTextIcon },
  { id: 'dialogues', label: 'Диалоги', Icon: ChatsCircleIcon },
]

export function SpanishReaderPage({
  title = 'Тексты и диалоги',
  header,
  onBack,
}: {
  title?: string
  header?: ReactNode
  onBack?: () => void
}) {
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
      {onBack ? (
        <BackHeader onBack={onBack} title={title} />
      ) : (
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      )}

      {header}

      <div className="flex gap-2">
        {kinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${
              kind === k.id
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            <k.Icon size={16} weight={kind === k.id ? 'fill' : 'regular'} />
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {spanishLevels.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
              level === l
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <p className="text-sm text-[var(--night-text-40)]">
        Выбери {kind === 'texts' ? 'текст' : 'диалог'} и нажимай на незнакомые
        слова — добавляй их в колоду.
      </p>

      <div className="flex flex-col gap-3">
        {kind === 'texts'
          ? readings.map((r) => (
              <button key={r.id} onClick={() => setReading(r)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-[var(--night-text-40)]">{r.titleRu}</p>
                </Card>
              </button>
            ))
          : dialogues.map((d) => (
              <button key={d.id} onClick={() => setDialogue(d)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{d.title}</p>
                  <p className="mt-1 text-sm text-[var(--night-text-40)]">
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
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-medium tracking-tight">{reading.title}</h1>
          <p className="truncate text-sm text-[var(--night-text-40)]">{reading.titleRu}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        {reading.paragraphs.map((p, i) => (
          <div key={i}>
            <p className={READER_CLASSES[getSettings().readerSize]}>
              <TappableText text={p.es} onSelect={setSelected} />
            </p>
            <button
              onClick={() => toggleRu(i)}
              className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-[var(--night-accent-text)]"
            >
              <TranslateIcon size={14} />
              {openRu.has(i) ? 'Скрыть перевод' : 'Перевод'}
            </button>
            {openRu.has(i) && (
              <p className="mt-1 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-[var(--night-text-70)] dark:bg-[var(--night-surface)] dark:text-[var(--night-text-25)]">
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
          <BackButton onClick={onBack} />
          <h1 className="truncate text-xl font-medium tracking-tight">{dialogue.title}</h1>
        </div>
        <Button
          variant="secondary"
          className="min-h-[44px] shrink-0 px-3 py-1.5 text-xs"
          onClick={() => setShowRu((s) => !s)}
        >
          <TranslateIcon size={14} />
          {showRu ? 'Скрыть перевод' : 'Перевод'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {dialogue.lines.map((line, i) => (
          <Card key={i} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--night-accent-text)]">
                  {line.speaker}
                </p>
                <p className="mt-0.5 leading-relaxed">
                  <TappableText text={line.es} onSelect={setSelected} />
                </p>
                {showRu && (
                  <p className="mt-1 text-sm text-[var(--night-text-40)]">{line.ru}</p>
                )}
              </div>
              <button
                onClick={() => speak(line.es, { lang: 'es' })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[var(--night-text-70)]"
                aria-label="Озвучить реплику"
              >
                <SpeakerHighIcon size={18} />
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
