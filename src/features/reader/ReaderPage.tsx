import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from '../../components/Card'
import { GuidedNext } from '../../components/GuidedNext'
import { BackHeader } from '../../components/BackButton'
import { MarkableText } from '../../components/MarkableText'
import { useLanguage } from '../../context/LanguageContext'
import { getUserLevel } from '../../lib/level'
import { getSettings, READER_CLASSES } from '../../lib/settings'
import { SpanishReaderPage } from './SpanishReader'
import { AddTextForm, MyTextReader, MyTextsList } from './MyTextsBlock'
import type { MyText } from '../../lib/myTexts'
import { sampleTexts, type SampleText } from './sampleTexts'
import type { CEFRLevel } from '../../types'
import { useScrollTop } from '../../lib/useScrollTop'

const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

/** Читалка: английский — тексты + словарь; испанский — свой раздел.
 *  «Мои тексты» (вставка/PDF/DOCX/TXT) — общие для обоих языков. */
export function ReaderPage({
  title = 'Тексты и диалоги',
  header,
  onBack,
}: {
  title?: string
  header?: ReactNode
  onBack?: () => void
}) {
  const { lang } = useLanguage()
  // свои тексты: 'add' — форма добавления, MyText — чтение
  const [my, setMy] = useState<'add' | MyText | null>(null)
  useEffect(() => setMy(null), [lang])

  if (my === 'add') {
    return (
      <AddTextForm
        lang={lang}
        onDone={(t) => setMy(t ?? null)}
      />
    )
  }
  if (my) {
    return <MyTextReader text={my} lang={lang} onBack={() => setMy(null)} />
  }

  const fullHeader = (
    <>
      {header}
      <MyTextsList lang={lang} onAdd={() => setMy('add')} onOpen={(t) => setMy(t)} />
    </>
  )
  if (lang === 'es') return <SpanishReaderPage title={title} header={fullHeader} onBack={onBack} />
  return <EnglishReaderPage title={title} header={fullHeader} onBack={onBack} />
}

function EnglishReaderPage({
  title,
  header,
  onBack,
}: {
  title: string
  header?: ReactNode
  onBack?: () => void
}) {
  const [level, setLevel] = useState<CEFRLevel>('B1')
  const [active, setActive] = useState<SampleText | null>(null)
  useScrollTop(active)
  // пока не пришёл уровень из профиля, не перещёлкивать вкладку под пальцем
  const userPicked = useRef(false)

  // стартовая вкладка — уровень пользователя (онбординг/placement), если он
  // известен; C2-текстов нет, поэтому C2 читает как C1
  useEffect(() => {
    let alive = true
    void getUserLevel('en').then((l) => {
      if (!alive || !l || userPicked.current) return
      const start = l === 'C2' ? 'C1' : l
      if ((levels as string[]).includes(start)) setLevel(start as CEFRLevel)
    })
    return () => {
      alive = false
    }
  }, [])

  const texts = sampleTexts.filter((t) => t.level === level)

  if (active) {
    return <Reader text={active} onBack={() => setActive(null)} />
  }

  return (
    <div className="flex flex-col gap-4">
      {onBack ? (
        <BackHeader onBack={onBack} title={title} />
      ) : (
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      )}

      {header}

      <div className="flex gap-2">
        {levels.map((l) => (
          <button
            key={l}
            onClick={() => {
              userPicked.current = true
              setLevel(l)
            }}
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
        Выбери текст и нажимай на незнакомые слова. Долгое нажатие и протяжка
        по словам — перевод целой фразы.
      </p>

      <div className="flex flex-col gap-3">
        {texts.map((t) => (
          <button key={t.id} onClick={() => setActive(t)} className="text-left">
            <Card className="transition-transform active:scale-[0.99]">
              <p className="font-semibold">{t.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--night-text-40)]">{t.body}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}

function Reader({ text, onBack }: { text: SampleText; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title={text.title} />

      <Card>
        <MarkableText text={text.body} lang="en" className={READER_CLASSES[getSettings().readerSize]} />
      </Card>

      {/* ведомая сессия: после текста предложить следующий шаг */}
      <GuidedNext step="reader" />
    </div>
  )
}
