// ============================================================================
// Текст читалки: тап по слову → шторка перевода (WordSheet, там же «Разбор
// предложения»). Плюс режим «Выделить фразу»: тапаешь ПЕРВОЕ и ПОСЛЕДНЕЕ слово
// фразы → та же шторка, но для всей фразы (перевод + пример + «в колоду»).
// Используется в читалках EN/ES, «Моих текстах» и заданиях.
// ============================================================================
import { useState } from 'react'
import { IconTranslate, IconSearch } from './icons'
import { TappableText, WordSheet, type WordPick } from './WordSheet'
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
  // одна шторка и для слова, и для фразы (WordSheet принимает любое «слово»)
  const [pick, setPick] = useState<WordPick | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [analyzeAll, setAnalyzeAll] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectMode((v) => !v)}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm ${
            selectMode
              ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)] text-[var(--night-accent-100)]'
              : 'border-white/[0.10] text-[var(--night-text-40)]'
          }`}
        >
          <IconTranslate size={14} />
          {selectMode ? 'Отмена' : 'Выделить фразу'}
        </button>
        <button
          onClick={() => setAnalyzeAll(true)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/[0.10] px-3.5 text-sm text-[var(--night-text-40)]"
        >
          <IconSearch size={14} />
          Разобрать весь текст
        </button>
      </div>

      <p className="text-xs text-[var(--night-text-40)]">
        {selectMode
          ? 'Тапни ПЕРВОЕ и ПОСЛЕДНЕЕ слово фразы — покажу перевод и пример.'
          : 'Тап по слову — перевод и «Разбор предложения». Нужна фраза — «Выделить фразу».'}
      </p>

      <p className={className}>
        <TappableText
          text={text}
          onSelect={setPick}
          selectMode={selectMode}
          onPhrase={(phrase, sentence) => {
            setPick({ word: phrase, sentence })
            setSelectMode(false)
          }}
        />
      </p>

      {pick && (
        <WordSheet word={pick.word} sentence={pick.sentence} lang={lang} onClose={() => setPick(null)} />
      )}

      {analyzeAll && (
        <TextAnalysisSheet text={text} lang={lang} onClose={() => setAnalyzeAll(false)} />
      )}
    </div>
  )
}
