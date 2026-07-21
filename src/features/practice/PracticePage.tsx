// ============================================================================
// «Практика» — хаб всех тренировок (вкладка нижней навигации, роут /practice).
// ТОЛЬКО игры и повторение — добавление слов и паки живут в «Учёба → Слова».
//
//   Повторение      — FSRS-колода свайпами (features/flashcards/DeckReview)
//   СЛОВА           — Значения · Пропуск · Перевод · Аудирование ·
//                     Спринт · Диктант · Собери фразу (features/words/*)
//   ГРАММАТИКА      — Выбери форму · Впиши слово · Собери предложение
//                     (GrammarMixMode по типам заданий, всё — под уровень) ·
//                     Мои ошибки (банк из lib/mistakes) · Глаголы
//   РЕЧЬ            — слушай и повторяй за диктором (features/pronunciation)
// ============================================================================
import type React from 'react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  IconRefresh,
  IconGap,
  IconMcq,
  IconHeadphones,
  IconKeyboard,
  IconMeaning,
  IconMic,
  IconPencil,
  IconPuzzle,
  IconRows,
  IconShuffle,
  IconTranslate,
  IconTimer,
  type IconProps,
  IconCards,
} from '../../components/icons'
import { Card } from '../../components/Card'
import { useLanguage } from '../../context/LanguageContext'
import { getDueCards } from '../../lib/fsrs'
import { countMyWords } from '../../lib/cards'
import { currentGuidedStep, skipReviewIfNoWords } from '../../lib/guided'
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
const GrammarMixMode = lazy(() =>
  import('./GrammarMixMode').then((m) => ({ default: m.GrammarMixMode })),
)

type Mode =
  | 'hub'
  | 'review'
  | 'match'
  | 'gap'
  | 'translate'
  | 'listening'
  | 'sentence'
  | 'sprint'
  | 'dictation'
  | 'gr-mcq'
  | 'gr-fill'
  | 'gr-order'

interface Tile {
  Icon: (p: IconProps) => React.JSX.Element
  title: string
  desc: string
  /** Внутренний режим хаба ИЛИ переход по роуту. */
  mode?: Exclude<Mode, 'hub' | 'review'>
  to?: string
  badge?: number
}

// Сетка плиток и заголовок секции — на уровне модуля, а НЕ внутри PracticePage.
// Если объявить их внутри, при каждой перерисовке (например, когда догрузится
// счётчик «к повторению») это будут новые типы компонентов — React снесёт и
// заново смонтирует сетку, и анимация fade-up проиграется заново = моргание.
function TileGrid({
  tiles,
  onOpen,
  delayBase = 0,
}: {
  tiles: Tile[]
  onOpen: (t: Tile) => void
  delayBase?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((t, i) => (
        <button
          key={t.title}
          onClick={() => onOpen(t)}
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
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--night-text-40)]">
      {children}
    </h2>
  )
}

const GAME_MODES = new Set<Mode>([
  'review', 'match', 'gap', 'translate', 'listening', 'sentence', 'sprint',
  'dictation', 'gr-mcq', 'gr-fill', 'gr-order',
])

export function PracticePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { lang } = useLanguage()
  const [due, setDue] = useState<number | null>(null)
  // сколько слов вообще: отличать «всё повторено» от «слов ещё нет»
  const [words, setWords] = useState<number | null>(null)

  // Режим мини-игры хранится в URL (?m=match). Тогда тап по вкладке «Практика»
  // (переход на /practice БЕЗ параметра) возвращает в хаб, и «назад» браузера
  // тоже работает. Раньше режим был в state — повторный тап по вкладке ничего
  // не делал, игра не открывалась заново.
  const raw = searchParams.get('m') as Mode | null
  const mode: Mode = raw && GAME_MODES.has(raw) ? raw : 'hub'
  const setMode = (m: Mode) =>
    setSearchParams(m === 'hub' ? {} : { m }, { replace: false })

  // ведомая сессия («Начать занятие» на Главной): при входе без параметра
  // открываем сразу повторение; если слов ещё нет — пропускаем пустой шаг
  // и уводим сессию сразу на чтение (skipReviewIfNoWords в lib/guided)
  useEffect(() => {
    if (currentGuidedStep() === 'flashcards' && !searchParams.get('m')) {
      let alive = true
      void skipReviewIfNoWords(lang).then((route) => {
        if (!alive) return
        if (route) navigate(route, { replace: true })
        else setSearchParams({ m: 'review' }, { replace: true })
      })
      return () => {
        alive = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // счётчик для плитки: сколько к повторению и есть ли слова вообще
  useEffect(() => {
    let alive = true
    getDueCards(50, lang)
      .then((d) => alive && setDue(d.length))
      .catch(() => alive && setDue(null))
    countMyWords(lang)
      .then((n) => alive && setWords(n))
      .catch(() => alive && setWords(null))
    return () => {
      alive = false
    }
  }, [lang])

  const back = () => {
    setMode('hub')
    getDueCards(50, lang).then((d) => setDue(d.length)).catch(() => {})
  }

  if (mode === 'review') return <DeckReview onBack={back} />
  if (mode !== 'hub') {
    return (
      <Suspense fallback={<p className="text-[var(--night-text-40)]">Загрузка…</p>}>
        {mode === 'match' && <MatchMode lang={lang} onBack={back} />}
        {mode === 'gap' && <GapMode lang={lang} onBack={back} />}
        {mode === 'translate' && <TranslateMode lang={lang} onBack={back} />}
        {mode === 'listening' && <ListeningMode lang={lang} onBack={back} />}
        {mode === 'sprint' && <SprintMode lang={lang} onBack={back} />}
        {mode === 'dictation' && <DictationMode lang={lang} onBack={back} />}
        {mode === 'sentence' && <SentenceBuilder lang={lang} onBack={back} />}
        {mode === 'gr-mcq' && <GrammarMixMode lang={lang} kind="mcq" onBack={back} />}
        {mode === 'gr-fill' && <GrammarMixMode lang={lang} kind="fill" onBack={back} />}
        {mode === 'gr-order' && <GrammarMixMode lang={lang} kind="order" onBack={back} />}
      </Suspense>
    )
  }

  const wordTiles: Tile[] = [
    { mode: 'match', Icon: IconMeaning, title: 'Значения', desc: 'Слово ↔ значение' },
    { mode: 'gap', Icon: IconGap, title: 'Пропущенное слово', desc: 'Слово в предложении' },
    { mode: 'translate', Icon: IconTranslate, title: 'Быстрый перевод', desc: 'Выбери верный' },
    { mode: 'listening', Icon: IconHeadphones, title: 'Аудирование', desc: 'Услышь и выбери' },
    { mode: 'sprint', Icon: IconTimer, title: 'Спринт', desc: 'Верно или нет · 60 сек' },
    { mode: 'dictation', Icon: IconKeyboard, title: 'Диктант', desc: 'Услышь и напиши' },
    { mode: 'sentence', Icon: IconPuzzle, title: 'Собери фразу', desc: 'Фраза из слов' },
  ]

  const mistakes = getMistakes(lang).length
  const grammarTiles: Tile[] = [
    { mode: 'gr-mcq', Icon: IconMcq, title: 'Выбери форму', desc: 'Тест с вариантами' },
    { mode: 'gr-fill', Icon: IconPencil, title: 'Впиши слово', desc: 'Заполни пропуск' },
    { mode: 'gr-order', Icon: IconRows, title: 'Собери предложение', desc: 'Порядок слов' },
    {
      to: '/grammar?mistakes=1',
      Icon: IconRefresh,
      title: 'Мои ошибки',
      desc: mistakes > 0 ? 'Повтори и закрой' : 'Пока пусто',
      badge: mistakes || undefined,
    },
    {
      to: '/grammar?verbs=1',
      Icon: IconShuffle,
      title: 'Глаголы',
      desc: lang === 'es' ? 'Спряжения: справочник и тренажёр' : 'Неправильные глаголы',
    },
  ]

  const speechTiles: Tile[] = [
    // название плитки = заголовок экрана, куда она ведёт (h1 «Речь»)
    { to: '/pronunciation', Icon: IconMic, title: 'Речь', desc: 'Слушай и повторяй за диктором' },
  ]

  const open = (t: Tile) => {
    if (t.mode) setMode(t.mode)
    else if (t.to) navigate(t.to)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Практика</h1>

      {/* Повторение — главный режим, широкой плиткой */}
      <button
        onClick={() => setMode('review')}
        className="lift animate-fade-up flex items-center gap-4 rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.20),rgba(145,132,217,.08))] px-4 py-4 text-left"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
          <IconCards size={28} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Повторение</span>
          <span className="block text-sm text-[var(--night-text-40)]">
            {due === null
              ? 'Слова по расписанию'
              : due > 0
                ? `К повторению: ${due}`
                : words === 0
                  ? 'Пока нет слов — добавь первые в Учёбе'
                  : 'На сегодня всё повторено'}
          </span>
        </span>
      </button>

      <p className="text-sm text-[var(--night-text-40)]">
        Игры используют твои слова и уроки твоего уровня. Ошибка вернёт слово
        или упражнение на повтор. Добавить слова — в «Учёба → Слова».
      </p>

      <SectionTitle>Слова</SectionTitle>
      <TileGrid tiles={wordTiles} onOpen={open} />

      <SectionTitle>Грамматика</SectionTitle>
      <TileGrid tiles={grammarTiles} onOpen={open} delayBase={0.1} />

      <SectionTitle>Речь</SectionTitle>
      <TileGrid tiles={speechTiles} onOpen={open} delayBase={0.15} />
    </div>
  )
}
