// ============================================================================
// Текст читалки: тап по слову → шторка перевода (WordSheet, там же «Разбор
// предложения»). Плюс режим «Выделить фразу»: тапаешь ПЕРВОЕ и ПОСЛЕДНЕЕ слово
// фразы → та же шторка, но для всей фразы (перевод + пример + «в колоду»).
// Используется в читалках EN/ES, «Моих текстах» и заданиях.
// ============================================================================
import { useState } from 'react'
import { IconTranslate, IconSearch } from '../shared/ui/icons'
import { TappableText, WordSheet, type WordPick } from './WordSheet'
import { PhraseSheet, type PhrasePick } from './PhraseSheet'
import { TextAnalysisSheet } from './TextAnalysisSheet'
import type { AppLang } from '../types'

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
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectMode((v) => !v)}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm ${
            selectMode
              ? 'border-accent-line bg-[rgba(145,132,217,.14)] text-accent-soft-fg'
              : 'border-tint/[0.10] text-fg-muted'
          }`}
        >
          <IconTranslate size={14} />
          {selectMode ? 'Отмена' : 'Выделить фразу'}
        </button>
        <button
          onClick={() => setAnalyzeAll(true)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-tint/[0.10] px-3.5 text-sm text-fg-muted"
        >
          <IconSearch size={14} />
          Разобрать весь текст
        </button>
      </div>

      <p className="text-xs text-fg-muted">
        {selectMode
          ? 'Тапни ПЕРВОЕ и ПОСЛЕДНЕЕ слово фразы — покажу перевод и пример.'
          : 'Тап по слову — перевод и «Разбор предложения». Нужна фраза — «Выделить фразу».'}
      </p>

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
