// ============================================================================
// «Слова» — хаб изучения лексики (EN и ES). Заменил прежнюю «Колоду» и
// испанскую «Практику»: всё, что связано со словами, теперь в одном месте.
//
// Режимы:
//   🔁 Повторение   — FSRS-колода свайпами (features/flashcards/DeckReview)
//   🧩 Значения     — Match: слово ↔ английское определение (в ES ↔ перевод)
//   ✏️ Пропуск      — слово в предложении
//   ⚡ Перевод      — слово ↔ перевод на скорость
//   🎧 Аудирование  — услышать и выбрать написание
//   🧱 Собери фразу — только испанский (перенесено из «Практики»)
//
// Игры лениво подгружают пул слов; ошибка в игре возвращает карточку на
// повтор (см. gameUtils.markWrong).
// ============================================================================
import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import {
  LinkSimpleIcon,
  TextAaIcon,
  PuzzlePieceIcon,
  HeadphonesIcon,
  CardsThreeIcon,
  BookOpenTextIcon,
  ListBulletsIcon,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PacksSheet } from '../flashcards/PacksSheet'
import { AddCardForm } from './AddCardForm'
import { useLanguage } from '../../context/LanguageContext'
import { countMyWords } from '../../lib/cards'
import { getDueCards } from '../../lib/fsrs'
import { currentGuidedStep } from '../../lib/guided'
import { DeckReview } from '../flashcards/DeckReview'

const MatchMode = lazy(() => import('./MatchMode').then((m) => ({ default: m.MatchMode })))
const GapMode = lazy(() => import('./QuizModes').then((m) => ({ default: m.GapMode })))
const TranslateMode = lazy(() =>
  import('./QuizModes').then((m) => ({ default: m.TranslateMode })),
)
const ListeningMode = lazy(() =>
  import('./QuizModes').then((m) => ({ default: m.ListeningMode })),
)
const SentenceBuilder = lazy(() =>
  import('./SentenceBuilder').then((m) => ({ default: m.SentenceBuilder })),
)
const MyWords = lazy(() => import('./MyWords').then((m) => ({ default: m.MyWords })))

type Mode =
  | 'hub'
  | 'review'
  | 'mywords'
  | 'match'
  | 'gap'
  | 'translate'
  | 'listening'
  | 'sentence'

interface ModeDef {
  id: Exclude<Mode, 'hub' | 'review'>
  Icon: Icon
  title: string
  desc: string
  esOnly?: boolean
}

const modes: ModeDef[] = [
  { id: 'mywords', Icon: ListBulletsIcon, title: 'Мои слова', desc: 'Список, поиск, правка' },
  { id: 'match', Icon: LinkSimpleIcon, title: 'Значения', desc: 'Слово ↔ значение' },
  { id: 'gap', Icon: BookOpenTextIcon, title: 'Пропуск', desc: 'Слово в предложении' },
  { id: 'translate', Icon: TextAaIcon, title: 'Перевод', desc: 'На скорость' },
  { id: 'listening', Icon: HeadphonesIcon, title: 'Аудирование', desc: 'Услышь и выбери' },
  { id: 'sentence', Icon: PuzzlePieceIcon, title: 'Собери фразу', desc: 'Фраза из слов', esOnly: true },
]

export function WordsPage() {
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
        {mode === 'sentence' && <SentenceBuilder onBack={back} />}
      </Suspense>
    )
  }

  const visible = modes.filter((m) => !m.esOnly || lang === 'es')

  return (
    <div className="flex flex-col gap-4">
      {/* Добавление слов — на уровне хаба: оно нужно из любого режима,
          а не только из повторения, где кнопки лежали раньше. */}
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Слова</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => {
              setSheet((s) => (s === 'packs' ? null : 'packs'))
            }}
          >
            {sheet === 'packs' ? 'Закрыть' : '📦 Паки'}
          </Button>
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => {
              setSheet((s) => (s === 'add' ? null : 'add'))
            }}
          >
            {sheet === 'add' ? 'Закрыть' : '+ Слово'}
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
        Тренировки на твоих словах — если карточек мало, добираем из паков уровня.
        Ошибка в игре вернёт слово в ближайшее повторение.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {visible.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="animate-fade-up text-left focus-visible:outline-none"
            style={{ animationDelay: `${0.05 + i * 0.05}s` }}
          >
            <Card interactive className="flex h-full flex-col p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
                <m.Icon size={22} />
              </span>
              <span className="mt-3 font-medium">{m.title}</span>
              <span className="text-sm text-[var(--night-text-40)]">
                {m.id === 'mywords' && total !== null ? `${total} слов · поиск, правка` : m.desc}
              </span>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}
