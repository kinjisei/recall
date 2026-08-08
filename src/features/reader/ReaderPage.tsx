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
import { listMyTexts } from '../../lib/myTexts'
import { sampleTexts, type SampleText } from './sampleTexts'
import type { CEFRLevel } from '../../types'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlState } from '../../lib/useUrlState'

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
  // Свои тексты — тоже в адресе (?mine=add | ?mine=<id>): без этого «назад» из
  // своего текста уводил из «Учёбы» целиком, а F5 терял открытое. Тексты живут
  // в localStorage устройства, поэтому ссылка работает только на нём — но
  // «назад» и перезагрузка должны работать везде одинаково.
  const [mineKey, setMineKey] = useUrlState(
    'mine',
    (v) => v === 'add' || listMyTexts(lang).some((t) => t.id === v),
  )
  const myText = mineKey && mineKey !== 'add'
    ? (listMyTexts(lang).find((t) => t.id === mineKey) ?? null)
    : null
  // Смена языка закрывает открытое (свои тексты у каждого языка свои).
  // ⚠️ Только при РЕАЛЬНОЙ смене: эффект с [lang] срабатывает и на первом
  // рендере, а это стёрло бы ?mine= из прямой ссылки ещё до показа текста.
  const prevLang = useRef(lang)
  useEffect(() => {
    if (prevLang.current !== lang) {
      prevLang.current = lang
      setMineKey(null)
    }
  }, [lang, setMineKey])

  if (mineKey === 'add') {
    return (
      <AddTextForm
        lang={lang}
        onDone={(t) => setMineKey(t ? t.id : null)}
      />
    )
  }
  if (myText) {
    return <MyTextReader text={myText} lang={lang} onBack={() => setMineKey(null)} />
  }

  const fullHeader = (
    <>
      {header}
      <MyTextsList lang={lang} onAdd={() => setMineKey('add')} onOpen={(t) => setMineKey(t.id)} />
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
  // Открытый текст — в адресе (?text=12). Даёт три вещи: «назад» возвращает в
  // список, а не на Главную; F5 не теряет текст; преподаватель может прислать
  // ссылку «прочитай вот это». Несуществующий id трактуется как «текст не
  // выбран» — чужая или устаревшая ссылка показывает список, а не пустоту.
  const [textId, setTextId] = useUrlState('text', (v) =>
    sampleTexts.some((t) => String(t.id) === v),
  )
  const active = textId ? (sampleTexts.find((t) => String(t.id) === textId) ?? null) : null
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
    return <Reader text={active} onBack={() => setTextId(null)} />
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
          <button key={t.id} onClick={() => setTextId(String(t.id))} className="text-left">
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
