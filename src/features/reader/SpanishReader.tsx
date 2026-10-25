// ============================================================================
// «Ввод» на испанском: тексты и диалоги из приложения spanish.
// Тап по слову → контекстный перевод (общая шторка WordSheet) → «в колоду».
// У каждого абзаца/реплики можно открыть русский перевод.
// ============================================================================
import { useState, type ReactNode } from 'react'
import {
  IconDialog,
  IconMaterials,
  IconSpeaker,
  IconTranslate,
  type IconProps,
} from '../../shared/ui/icons'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { BackButton, BackHeader } from '../../shared/ui/BackButton'
import { TabPicker } from '../../shared/ui/TabPicker'
import { speak } from '../../lib/speech'
import { TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
import { ReadingScreen } from './ReadingScreen'
import {
  spanishDialogues,
  spanishLevels,
  spanishReadings,
} from '../../data/spanish'
import type { SpanishDialogue, SpanishReading } from '../../types'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlState } from '../../shared/lib/useUrlState'

type Kind = 'texts' | 'dialogues'

const kinds: { id: Kind; label: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { id: 'texts', label: 'Тексты', Icon: IconMaterials },
  { id: 'dialogues', label: 'Диалоги', Icon: IconDialog },
]

export function SpanishReaderPage({
  title = 'Чтение',
  header,
  onBack,
}: {
  title?: string
  header?: ReactNode
  onBack?: () => void
}) {
  const [kind, setKind] = useState<Kind>('texts')
  const [level, setLevel] = useState<string>('A1')
  // Открытый текст/диалог — в адресе (?es=text-12 или ?es=dlg-5), как в
  // английской читалке: «назад» возвращает в список, F5 не теряет место,
  // ссылку можно прислать ученику. Неизвестный ключ (устаревшая ссылка)
  // трактуется как «ничего не открыто» — показывается список.
  const [esKey, setEsKey] = useUrlState(
    'es',
    (v) =>
      spanishReadings.some((r) => `text-${r.id}` === v) ||
      spanishDialogues.some((d) => `dlg-${d.id}` === v),
  )
  const reading = esKey?.startsWith('text-')
    ? (spanishReadings.find((r) => `text-${r.id}` === esKey) ?? null)
    : null
  const dialogue = esKey?.startsWith('dlg-')
    ? (spanishDialogues.find((d) => `dlg-${d.id}` === esKey) ?? null)
    : null
  useScrollTop(esKey)

  if (reading) {
    return <ReadingView reading={reading} onBack={() => setEsKey(null)} />
  }
  if (dialogue) {
    return <DialogueView dialogue={dialogue} onBack={() => setEsKey(null)} />
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

      <TabPicker options={kinds} value={kind} onChange={setKind} ariaLabel="Тип чтения" />

      <TabPicker
        options={spanishLevels.map((l) => ({ id: l, label: l }))}
        value={level}
        onChange={setLevel}
        ariaLabel="Уровень"
      />

      <p className="text-sm text-fg-muted">
        Выбери {kind === 'texts' ? 'текст' : 'диалог'} и нажимай на незнакомые
        слова — добавляй их в колоду.
      </p>

      <div className="flex flex-col gap-3">
        {kind === 'texts'
          ? readings.map((r) => (
              <button key={r.id} onClick={() => setEsKey(`text-${r.id}`)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-fg-muted">{r.titleRu}</p>
                </Card>
              </button>
            ))
          : dialogues.map((d) => (
              <button key={d.id} onClick={() => setEsKey(`dlg-${d.id}`)} className="text-left">
                <Card className="transition-transform active:scale-[0.99]">
                  <p className="font-semibold">{d.title}</p>
                  <p className="mt-1 text-sm text-fg-muted">
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
  // тот же экран чтения, что у английских текстов (макет d6); перевод абзаца — по кнопке
  return (
    <ReadingScreen
      title={reading.title}
      subtitle={reading.titleRu}
      backLabel="Тексты"
      onBack={onBack}
      level={reading.level}
      lang="es"
      paragraphs={reading.paragraphs.map((p) => ({ text: p.es, ru: p.ru }))}
    />
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
          <IconTranslate size={14} />
          {showRu ? 'Скрыть перевод' : 'Перевод'}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {dialogue.lines.map((line, i) => (
          <Card key={i} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-accent-strong">
                  {line.speaker}
                </p>
                <p className="mt-0.5 leading-relaxed">
                  <TappableText text={line.es} onSelect={setSelected} />
                </p>
                {showRu && (
                  <p className="mt-1 text-sm text-fg-muted">{line.ru}</p>
                )}
              </div>
              <button
                onClick={() => speak(line.es, { lang: 'es' })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint/[0.08] text-fg-secondary"
                aria-label="Озвучить реплику"
              >
                <IconSpeaker size={18} />
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
