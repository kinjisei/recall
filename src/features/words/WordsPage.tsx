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
import { Card } from '../../components/Card'
import { IconLink, IconType, IconBlocks, IconHeadphones, IconDeck, IconBook } from '../../components/icons'
import { useLanguage } from '../../context/LanguageContext'
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

type Mode = 'hub' | 'review' | 'match' | 'gap' | 'translate' | 'listening' | 'sentence'
type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'rose'

interface ModeDef {
  id: Exclude<Mode, 'hub'>
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: Tone
  title: string
  desc: string
  esOnly?: boolean
}

const toneChip: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
}

const modes: ModeDef[] = [
  { id: 'match', Icon: IconLink, tone: 'violet', title: 'Значения', desc: 'Слово ↔ значение' },
  { id: 'gap', Icon: IconBook, tone: 'amber', title: 'Пропуск', desc: 'Слово в предложении' },
  { id: 'translate', Icon: IconType, tone: 'emerald', title: 'Перевод', desc: 'На скорость' },
  { id: 'listening', Icon: IconHeadphones, tone: 'rose', title: 'Аудирование', desc: 'Услышь и выбери' },
  { id: 'sentence', Icon: IconBlocks, tone: 'sky', title: 'Собери фразу', desc: 'Фраза из слов', esOnly: true },
]

export function WordsPage() {
  const { lang } = useLanguage()
  // во время ведомой сессии («Начать занятие» на Главной) открываем сразу
  // повторение — пользователь ждёт карточки, а не меню режимов
  const [mode, setMode] = useState<Mode>(() =>
    currentGuidedStep() === 'flashcards' ? 'review' : 'hub',
  )
  const [due, setDue] = useState<number | null>(null)

  // сколько карточек ждёт повторения — показываем на плитке
  useEffect(() => {
    let alive = true
    setMode(currentGuidedStep() === 'flashcards' ? 'review' : 'hub')
    getDueCards(50, lang)
      .then((d) => alive && setDue(d.length))
      .catch(() => alive && setDue(null))
    return () => {
      alive = false
    }
  }, [lang])

  const back = () => setMode('hub')

  if (mode === 'review') return <DeckReview onBack={back} />
  if (mode !== 'hub') {
    return (
      <Suspense fallback={<p className="text-slate-500">Загрузка…</p>}>
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
      <h1 className="text-2xl font-bold">🗂 Слова</h1>

      {/* Повторение — главный режим, широкой плиткой */}
      <button onClick={() => setMode('review')} className="text-left focus-visible:outline-none">
        <Card interactive className="flex items-center gap-4">
          <div className="bg-brand-gradient flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white">
            <IconDeck className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Повторение</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {due === null
                ? 'Карточки по расписанию'
                : due > 0
                  ? `К повторению: ${due}`
                  : 'На сегодня всё повторено'}
            </p>
          </div>
        </Card>
      </button>

      <p className="text-sm text-slate-500">
        Тренировки на твоих словах — если карточек мало, добираем из паков уровня.
        Ошибка в игре вернёт слово в ближайшее повторение.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {visible.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="text-left focus-visible:outline-none"
          >
            <Card interactive className="flex h-full flex-col">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneChip[m.tone]}`}>
                <m.Icon className="h-6 w-6" />
              </div>
              <div className="mt-3 font-semibold">{m.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{m.desc}</div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}
