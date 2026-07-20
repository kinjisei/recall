// ============================================================================
// «Практика» — хаб всех тренировок (вкладка нижней навигации, роут /practice).
// Развитие прежнего хаба «Слова»: сюда же влиты грамматические тренажёры и
// «Речь», чтобы новичок видел все способы практиковаться в одном месте.
//
//   Повторение      — FSRS-колода свайпами (features/flashcards/DeckReview)
//   СЛОВА           — Мои слова · Значения · Пропуск · Перевод · Аудирование ·
//                     Спринт · Диктант · Собери фразу (features/words/*)
//   ГРАММАТИКА      — Микс упражнений (случайные из уроков под уровень) ·
//                     Мои ошибки (банк из lib/mistakes) · Глаголы
//   РЕЧЬ            — шэдоуинг (features/pronunciation)
// ============================================================================
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowsClockwiseIcon,
  BookOpenTextIcon,
  CardsThreeIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  KeyboardIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  MicrophoneIcon,
  PackageIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ShuffleIcon,
  TextAaIcon,
  TimerIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PacksSheet } from '../flashcards/PacksSheet'
import { AddCardForm } from '../words/AddCardForm'
import { useLanguage } from '../../context/LanguageContext'
import { countMyWords } from '../../lib/cards'
import { getDueCards } from '../../lib/fsrs'
import { currentGuidedStep } from '../../lib/guided'
import { getMistakes } from '../../lib/mistakes'
import { DeckReview } from '../flashcards/DeckReview'

const MatchMode = lazy(() => import('../words/MatchMode').then((m) => ({ default: m.MatchMode })))
const GapMode = lazy(() => import('../words/QuizModes').then((m) => ({ default: m.GapMode })))
const TranslateMode = lazy(() =>
  import('../words/QuizModes').then((m) => ({ default: m.TranslateMode })),
)
const ListeningMode = lazy(() =>
  import('../words/QuizModes').then((m) => ({ default: m.ListeningMode })),
)
const SentenceBuilder = lazy(() =>
  import('../words/SentenceBuilder').then((m) => ({ default: m.SentenceBuilder })),
)
const SprintMode = lazy(() => import('../words/SprintMode').then((m) => ({ default: m.SprintMode })))
const DictationMode = lazy(() =>
  import('../words/DictationMode').then((m) => ({ default: m.DictationMode })),
)
const MyWords = lazy(() => import('../words/MyWords').then((m) => ({ default: m.MyWords })))
const GrammarMixMode = lazy(() =>
  import('./GrammarMixMode').then((m) => ({ default: m.GrammarMixMode })),
)

type Mode =
  | 'hub'
  | 'review'
  | 'mywords'
  | 'match'
  | 'gap'
  | 'translate'
  | 'listening'
  | 'sentence'
  | 'sprint'
  | 'dictation'
  | 'grammix'

interface Tile {
  Icon: Icon
  title: string
  desc: string
  /** Внутренний режим хаба ИЛИ переход по роуту. */
  mode?: Exclude<Mode, 'hub' | 'review'>
  to?: string
  badge?: number
}

export function PracticePage() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  // во время ведомой сессии («Начать занятие» на Главной) открываем сразу
  // повторение — пользователь ждёт карточки, а не меню режимов
  const [mode, setMode] = useState<Mode>(() =>
    currentGuidedStep() === 'flashcards' ? 'review' : 'hub',
  )
  const [due, setDue] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [sheet, setSheet] = useState<null | 'add' | 'packs'>(null)

  // счётчики для плиток: сколько к повторению и сколько слов всего
  useEffect(() => {
    let alive = true
    setMode(currentGuidedStep() === 'flashcards' ? 'review' : 'hub')
    setSheet(null)
    getDueCards(50, lang)
      .then((d) => alive && setDue(d.length))
      .catch(() => alive && setDue(null))
    countMyWords(lang)
      .then((n) => alive && setTotal(n))
      .catch(() => alive && setTotal(null))
    return () => {
      alive = false
    }
  }, [lang])

  /** Счётчики устаревают после добавления/удаления слов. */
  const refreshCounts = () => {
    countMyWords(lang).then(setTotal).catch(() => {})
    getDueCards(50, lang).then((d) => setDue(d.length)).catch(() => {})
  }

  const back = () => {
    setMode('hub')
    refreshCounts()
  }

  if (mode === 'review') return <DeckReview onBack={back} />
  if (mode !== 'hub') {
    return (
      <Suspense fallback={<p className="text-[var(--night-text-40)]">Загрузка…</p>}>
        {mode === 'mywords' && <MyWords lang={lang} onBack={back} />}
        {mode === 'match' && <MatchMode lang={lang} onBack={back} />}
        {mode === 'gap' && <GapMode lang={lang} onBack={back} />}
        {mode === 'translate' && <TranslateMode lang={lang} onBack={back} />}
        {mode === 'listening' && <ListeningMode lang={lang} onBack={back} />}
        {mode === 'sprint' && <SprintMode lang={lang} onBack={back} />}
        {mode === 'dictation' && <DictationMode lang={lang} onBack={back} />}
        {mode === 'sentence' && <SentenceBuilder lang={lang} onBack={back} />}
        {mode === 'grammix' && <GrammarMixMode lang={lang} onBack={back} />}
      </Suspense>
    )
  }

  const wordTiles: Tile[] = [
    { mode: 'mywords', Icon: ListBulletsIcon, title: 'Мои слова', desc: total !== null ? `${total} слов · поиск, правка` : 'Список, поиск, правка' },
    { mode: 'match', Icon: LinkSimpleIcon, title: 'Значения', desc: 'Слово ↔ значение' },
    { mode: 'gap', Icon: BookOpenTextIcon, title: 'Пропуск', desc: 'Слово в предложении' },
    { mode: 'translate', Icon: TextAaIcon, title: 'Перевод', desc: 'Выбери верный' },
    { mode: 'listening', Icon: HeadphonesIcon, title: 'Аудирование', desc: 'Услышь и выбери' },
    { mode: 'sprint', Icon: TimerIcon, title: 'Спринт', desc: 'Верно или нет · 60 сек' },
    { mode: 'dictation', Icon: KeyboardIcon, title: 'Диктант', desc: 'Услышь и напиши' },
    { mode: 'sentence', Icon: PuzzlePieceIcon, title: 'Собери фразу', desc: 'Фраза из слов' },
  ]

  const mistakes = getMistakes(lang).length
  const grammarTiles: Tile[] = [
    { mode: 'grammix', Icon: GraduationCapIcon, title: 'Микс упражнений', desc: 'Случайные из уроков' },
    {
      to: '/grammar?mistakes=1',
      Icon: ArrowsClockwiseIcon,
      title: 'Мои ошибки',
      desc: mistakes > 0 ? 'Повтори и закрой' : 'Пока пусто',
      badge: mistakes || undefined,
    },
    {
      to: '/grammar?verbs=1',
      Icon: ShuffleIcon,
      title: 'Глаголы',
      desc: lang === 'es' ? 'Спряжения: справочник и тренажёр' : 'Неправильные глаголы',
    },
  ]

  const speechTiles: Tile[] = [
    { to: '/pronunciation', Icon: MicrophoneIcon, title: 'Произношение', desc: 'Шэдоуинг: слушай и повторяй' },
  ]

  const open = (t: Tile) => {
    if (t.mode) setMode(t.mode)
    else if (t.to) navigate(t.to)
  }

  const TileGrid = ({ tiles, delayBase = 0 }: { tiles: Tile[]; delayBase?: number }) => (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t, i) => (
        <button
          key={t.title}
          onClick={() => open(t)}
          className="animate-fade-up text-left focus-visible:outline-none"
          style={{ animationDelay: `${delayBase + 0.05 + i * 0.04}s` }}
        >
          <Card interactive className="relative flex h-full flex-col p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
              <t.Icon size={22} />
            </span>
            {t.badge !== undefined && (
              <span className="absolute right-3 top-3 rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
                {t.badge}
              </span>
            )}
            <span className="mt-3 font-medium">{t.title}</span>
            <span className="text-sm text-[var(--night-text-40)]">{t.desc}</span>
          </Card>
        </button>
      ))}
    </div>
  )

  const SectionTitle = ({ children }: { children: string }) => (
    <h2 className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--night-text-40)]">
      {children}
    </h2>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Добавление слов — на уровне хаба: нужно из любого режима */}
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Практика</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => setSheet((s) => (s === 'packs' ? null : 'packs'))}
          >
            {sheet === 'packs' ? (
              'Закрыть'
            ) : (
              <>
                <PackageIcon size={16} /> Паки
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => setSheet((s) => (s === 'add' ? null : 'add'))}
          >
            {sheet === 'add' ? (
              'Закрыть'
            ) : (
              <>
                <PlusIcon size={16} /> Слово
              </>
            )}
          </Button>
        </div>
      </header>

      {sheet === 'add' && <AddCardForm lang={lang} onAdded={refreshCounts} />}
      {sheet === 'packs' && <PacksSheet lang={lang} onAdded={refreshCounts} />}

      {/* Повторение — главный режим, широкой плиткой */}
      <button
        onClick={() => setMode('review')}
        className="lift animate-fade-up flex items-center gap-4 rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.20),rgba(145,132,217,.08))] px-4 py-4 text-left"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
          <CardsThreeIcon size={28} weight="fill" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Повторение</span>
          <span className="block text-sm text-[var(--night-text-40)]">
            {due === null
              ? 'Карточки по расписанию'
              : due > 0
                ? `К повторению: ${due}`
                : 'На сегодня всё повторено'}
          </span>
        </span>
      </button>

      <p className="text-sm text-[var(--night-text-40)]">
        Игры используют твои слова (если их мало — добираем из паков уровня).
        Ошибка вернёт слово или упражнение на повтор.
      </p>

      <SectionTitle>Слова</SectionTitle>
      <TileGrid tiles={wordTiles} />

      <SectionTitle>Грамматика</SectionTitle>
      <TileGrid tiles={grammarTiles} delayBase={0.1} />

      <SectionTitle>Речь</SectionTitle>
      <TileGrid tiles={speechTiles} delayBase={0.15} />
    </div>
  )
}
