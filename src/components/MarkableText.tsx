// ============================================================================
// Текст задания: тап по слову → шторка перевода (WordSheet, там же «Разбор
// предложения»). Плюс режим «Выделить фразу»: тапаешь ПЕРВОЕ и ПОСЛЕДНЕЕ слово
// фразы → та же шторка, но для всей фразы (перевод + пример + «в колоду»).
// Используется в заданиях; тексты для чтения — экран `features/reader/
// ReadingScreen` (d6) с теми же кнопками `ReadingTools`.
// ============================================================================
import { useState } from 'react'
import { IconTranslate, IconSearch } from '../shared/ui/icons'
import { TappableText, WordSheet, type WordPick } from './WordSheet'
import { PhraseSheet, type PhrasePick } from './PhraseSheet'
import { TextAnalysisSheet } from './TextAnalysisSheet'
import type { AppLang } from '../types'

const toolClass = 'flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm'

/** «Выделить фразу» и «Разобрать весь текст» — одни на чтение и задания; на телефоне — в один ряд. */
export function ReadingTools({
  selectMode,
  onToggleSelect,
  onAnalyzeAll,
  idleHint,
}: {
  selectMode: boolean
  onToggleSelect: () => void
  onAnalyzeAll: () => void
  /** Подсказка, пока фразу не выделяют (в заданиях — как пользоваться текстом). */
  idleHint?: string
}) {
  const hint = selectMode ? 'Тапни ПЕРВОЕ и ПОСЛЕДНЕЕ слово фразы — покажу перевод и пример.' : idleHint
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selectMode}
          className={`${toolClass} ${selectMode ? 'bg-accent-soft text-accent-soft-fg' : 'bg-input text-fg-secondary'}`}
        >
          <IconTranslate size={14} aria-hidden />
          {selectMode ? 'Отмена' : 'Выделить фразу'}
        </button>
        <button type="button" onClick={onAnalyzeAll} className={`${toolClass} bg-input text-fg-secondary`}>
          <IconSearch size={14} aria-hidden />
          Разобрать весь текст
        </button>
      </div>
      {hint && <p className="text-note text-fg-muted">{hint}</p>}
    </div>
  )
}

export function MarkableText({
  text,
  lang,
  className,
}: {
  text: string
  lang: AppLang
  /** Классы абзаца (размер текста читалки). */
  className?: string
}) {
  const [pick, setPick] = useState<WordPick | null>(null) // одно слово → WordSheet
  const [phrase, setPhrase] = useState<PhrasePick | null>(null) // фраза → PhraseSheet
  const [selectMode, setSelectMode] = useState(false)
  const [analyzeAll, setAnalyzeAll] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <ReadingTools
        selectMode={selectMode}
        onToggleSelect={() => setSelectMode((v) => !v)}
        onAnalyzeAll={() => setAnalyzeAll(true)}
        idleHint="Тап по слову — перевод и «Разбор предложения». Нужна фраза — «Выделить фразу»."
      />

      <p className={className}>
        <TappableText
          text={text}
          onSelect={setPick}
          selectMode={selectMode}
          onPhrase={(p, sentence) => {
            setPhrase({ text: p, sentence })
            setSelectMode(false)
          }}
        />
      </p>

      {pick && (
        <WordSheet word={pick.word} sentence={pick.sentence} lang={lang} onClose={() => setPick(null)} />
      )}

      {phrase && (
        <PhraseSheet
          text={phrase.text}
          sentence={phrase.sentence}
          lang={lang}
          onClose={() => setPhrase(null)}
        />
      )}

      {analyzeAll && (
        <TextAnalysisSheet text={text} lang={lang} onClose={() => setAnalyzeAll(false)} />
      )}
    </div>
  )
}
