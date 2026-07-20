import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { GuidedNext } from '../../components/GuidedNext'
import { TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
import { useLanguage } from '../../context/LanguageContext'
import { SpanishReaderPage } from './SpanishReader'
import { sampleTexts, type SampleText } from './sampleTexts'
import type { CEFRLevel } from '../../types'

const levels: CEFRLevel[] = ['B1', 'B2', 'C1']

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
  const [pick, setPick] = useState<WordPick | null>(null)

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
          <TappableText text={text.body} onSelect={setPick} />
        </p>
      </Card>

      {/* ведомая сессия: после текста предложить следующий шаг */}
      <GuidedNext step="reader" />

      {pick && (
        <WordSheet
          word={pick.word}
          sentence={pick.sentence}
          lang="en"
          onClose={() => setPick(null)}
        />
      )}
    </div>
  )
}
