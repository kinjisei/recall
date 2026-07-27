import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Card } from '../../components/Card'
import { GuidedNext } from '../../components/GuidedNext'
import { BackHeader } from '../../components/BackButton'
import { TabPicker } from '../../components/TabPicker'
import { MarkableText } from '../../components/MarkableText'
import { useLanguage } from '../../context/LanguageContext'
import { getUserLevel } from '../../lib/level'
import { getSettings, READER_CLASSES } from '../../lib/settings'
// SpanishReader тянет весь испанский контент (data/spanish, ~246КБ). Статический
// импорт грузил его на «Учёбе» ДАЖЕ английскому ученику, который его не увидит.
// Лениво: испанские данные приезжают только когда язык реально ES.
const SpanishReaderPage = lazy(() =>
  import('./SpanishReader').then((m) => ({ default: m.SpanishReaderPage })),
)
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
  if (lang === 'es')
    return (
      <Suspense fallback={<Card>Загрузка…</Card>}>
        <SpanishReaderPage title={title} header={fullHeader} onBack={onBack} />
      </Suspense>
    )
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

      <TabPicker
        options={levels.map((l) => ({ id: l, label: l }))}
        value={level}
        onChange={(l) => {
          userPicked.current = true
          setLevel(l)
        }}
        ariaLabel="Уровень текста"
      />

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
