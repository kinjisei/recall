// ============================================================================
// Перевод слова в читалке — содержимое одно на шторку (WordSheet: телефон,
// задания) и панель сбоку текста (WordPanel: компьютер, макет d6-2):
// «/wɪðˈstænd/ · глагол», плашка «В этом тексте — выдержать», пояснение,
// примеры со словом жирным (предложение из текста и пример словаря), «+ В мои
// слова» → «✓ Добавлено». Данные — useWordLookup (wordLookup.ts).
// ============================================================================
import type { ReactNode } from 'react'
import { Button } from '../shared/ui/Button'
import { ErrorText } from '../shared/ui/ErrorText'
import { IconCheck, IconClose, IconPlus, IconSearch, IconSpeaker } from '../shared/ui/icons'
import { Thinking } from '../shared/ui/Thinking'
import type { AppLang } from '../types'
import { useWordLookup, type WordLookup } from './wordLookup'

/** Слово жирным внутри примера (целым словом, без учёта регистра). */
function Highlight({ text, word }: { text: string; word: string }) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(?<![\\p{L}])(${esc})(?![\\p{L}])`, 'iu'))
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <b key={i} className="font-semibold text-fg">{p}</b> : p))}
    </>
  )
}

/** Тело перевода: транскрипция и часть речи, «В этом тексте», пояснение, примеры. */
export function WordFacts({ look, word, sentence }: { look: WordLookup; word: string; sentence: string }) {
  const { ctx, ctxError, ipa, pos, example } = look
  const meta = [ipa && `/${ipa}/`, pos].filter(Boolean).join(' · ')
  return (
    <div className="flex flex-col gap-3">
      {meta && <p className="text-note text-fg-muted">{meta}</p>}
      {!ctx && !ctxError && <Thinking label="Перевожу в контексте" />}
      {ctx && (
        <div className="rounded-control bg-accent-soft px-3.5 py-3 text-accent-soft-fg">
          <p className="text-caption">В этом тексте</p>
          <p className="text-base font-semibold">{ctx.translation}</p>
        </div>
      )}
      {ctx?.note && <p className="text-note text-fg-muted">{ctx.note}</p>}
      {ctxError && <p className="text-sm text-fg-muted">Перевод сейчас недоступен — слово всё равно можно добавить в мои слова.</p>}
      <ul className="flex flex-col gap-2">
        {[sentence, example].filter((s): s is string => !!s).map((s) => (
          <li key={s} className="border-l-2 border-line pl-2.5 text-note leading-snug text-fg-secondary">
            <Highlight text={s} word={ctx?.base && example === s ? ctx.base : word} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** «+ В мои слова» → «✓ Добавлено» (d6). */
export function AddWordButton({ look, className = '' }: { look: WordLookup; className?: string }) {
  if (look.added) {
    return (
      <span role="status" className={`flex min-h-11 items-center justify-center gap-2 rounded-control-sm bg-success-soft text-sm font-semibold text-success-strong ${className}`}>
        <IconCheck size={18} aria-hidden /> Добавлено
      </span>
    )
  }
  return (
    <Button size="sm" className={className} onClick={() => void look.addToDeck()} loading={look.busy}>
      <IconPlus size={18} aria-hidden /> В мои слова
    </Button>
  )
}

/** Слово крупно и «озвучить» рядом; начальная форма — «→ withstand». */
export function WordTitle({ look, word, id }: { look: WordLookup; word: string; id?: string }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <h2 id={id} className="min-w-0 flex-1 text-xl font-semibold text-fg">
        {word.toLowerCase()}
        {look.baseDiffers && <span className="ml-2 text-base font-normal text-fg-muted">→ {look.ctx?.base}</span>}
      </h2>
      <button
        type="button"
        onClick={look.playAudio}
        aria-label="Озвучить"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"
      >
        <IconSpeaker size={18} />
      </button>
    </div>
  )
}

/** Панель перевода сбоку текста (компьютер, d6-2): «Перевод ×», слово, факты, «В мои слова». */
export function WordPanel({
  word,
  sentence,
  lang,
  onClose,
  onAdded,
  onAnalyze,
}: {
  word: string
  sentence: string
  lang: AppLang
  onClose: () => void
  onAdded?: (front: string, back: string) => void
  /** «Разбор предложения» — шторка разбора. */
  onAnalyze?: () => void
}) {
  const look = useWordLookup(word, sentence, lang, onAdded)
  return (
    <section aria-label={`Перевод: ${word}`} className="flex flex-col gap-3">
      <div className="-mt-1 flex items-center justify-between">
        <p className="text-caption font-semibold text-fg-muted">Перевод</p>
        <button type="button" onClick={onClose} aria-label="Закрыть перевод" className="-mr-2 flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-tint/[0.06]">
          <IconClose size={18} />
        </button>
      </div>
      <WordTitle look={look} word={word} />
      <WordFacts look={look} word={word} sentence={sentence} />
      {look.error && <ErrorText>{look.error}</ErrorText>}
      <AddWordButton look={look} className="w-full" />
      {onAnalyze && (
        <button type="button" onClick={onAnalyze} className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-medium text-accent-strong">
          <IconSearch size={16} aria-hidden /> Разбор предложения
        </button>
      )}
    </section>
  )
}
