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
//   РЕЧЬ            — слушай фразу и повторяй вслух (features/pronunciation)
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
import { Button } from '../../components/Button'
import { useLanguage } from '../../context/LanguageContext'
import { countDueCards } from '../../lib/fsrs'
import { countMyWords } from '../../lib/cards'
import { markAutoOpened, shouldAutoOpen, skipReviewIfNoWords } from '../../lib/guided'
import { getMistakes } from '../../lib/mistakes'
import { DeckReview } from '../flashcards/DeckReview'
import { useScrollTop } from '../../lib/useScrollTop'
import { useFocusMode } from '../../components/Layout'
import { Loading } from '../../components/Loading'
import { markMorph } from '../../lib/morph'
import { withViewTransition } from '../../lib/viewTransition'

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
          onClick={(e) => {
            // плитка «вырастает» в экран игры: помечаем её общим элементом
            // перехода ДО смены состояния (см. lib/morph.ts)
            markMorph(e.currentTarget)
            onOpen(t)
          }}
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

/** Раздел «Практики»: раскрыт один, остальные свёрнуты рядом. */
type GroupId = 'review' | 'words' | 'grammar' | 'speech'
const GROUP_IDS = new Set<string>(['review', 'words', 'grammar', 'speech'])

interface PracticeGroup {
  id: GroupId
  title: string
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element
  hint: string
  badge?: number
}

const GROUP_KEY = 'recall.practice_group'

/** Раздел, раскрытый в прошлый раз. Приватный режим — просто «Повторение». */
function lastGroup(): GroupId {
  try {
    const v = localStorage.getItem(GROUP_KEY)
    return v && GROUP_IDS.has(v) ? (v as GroupId) : 'review'
  } catch {
    return 'review'
  }
}
function rememberGroup(g: GroupId): void {
  try {
    localStorage.setItem(GROUP_KEY, g)
  } catch {
    /* не критично */
  }
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
  // смена ?m= маршрут не меняет — глобальный ScrollToTop не срабатывает
  useScrollTop(mode)
  // на время раунда убираем шапку и нижнюю навигацию: без них игра влезает в
  // экран целиком и перестаёт «ездить» на каждом тапе (см. Layout)
  useFocusMode(mode !== 'hub')
  // Заход в игру пушит запись в историю, выход кареткой — ЗАМЕНЯЕТ её.
  // Раньше выход тоже пушил, и свайп-назад после выхода возвращал обратно в
  // только что закрытый «Спринт» (замер ревью 1Г). Правило то же, что в общем
  // хуке lib/useUrlState — здесь оно записано руками, потому что режим ещё
  // и переключается программно (ведомая сессия ниже).
  const setMode = (m: Mode) =>
    setSearchParams(m === 'hub' ? {} : { m }, { replace: m === 'hub' })

  // Раскрытый раздел — в адресе (?g=words), чтобы возврат из игры возвращал в
  // тот же раздел, а не в начало. Смена раздела ЗАМЕНЯЕТ запись в истории:
  // это фильтр внутри экрана, а не заход вглубь, — иначе «назад» пришлось бы
  // жать столько раз, сколько разделов человек посмотрел.
  const rawGroup = searchParams.get('g')
  // Последний раздел помним между заходами. Группировка сделала игры на тап
  // дальше — это плата за то, что новичок больше не упирается в стену из
  // тринадцати одинаковых квадратов. Но тому, кто каждый день играет в
  // «Спринт», платить этим тапом ежедневно незачем: возвращаем туда, где он
  // был. По умолчанию (первый заход) раскрыто «Повторение» — оно важнее игр.
  const group: GroupId =
    rawGroup && GROUP_IDS.has(rawGroup) ? (rawGroup as GroupId) : lastGroup()
  const setGroup = (g: GroupId) => {
    rememberGroup(g)
    withViewTransition('in', () => {
      const next = new URLSearchParams(searchParams)
      if (g === 'review') next.delete('g')
      else next.set('g', g)
      setSearchParams(next, { replace: true })
    })
  }

  // Ведомая сессия («Начать занятие» на Главной): при входе без параметра
  // открываем сразу повторение; если слов ещё нет — пропускаем пустой шаг и
  // уводим сессию на чтение (skipReviewIfNoWords в lib/guided).
  //
  // ⚠️ Уводим РОВНО ОДИН РАЗ. Правило спрашиваем у guided.ts, а не решаем
  // здесь: тот же перехват есть в «Учёбе», и два экземпляра условия разошлись
  // бы молча. Отметку ставим в момент самой навигации — см. shouldAutoOpen.
  useEffect(() => {
    if (shouldAutoOpen('flashcards') && !searchParams.get('m')) {
      let alive = true
      void skipReviewIfNoWords(lang).then((route) => {
        if (!alive) return
        markAutoOpened('flashcards')
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
    // ⚠️ Считаем countDueCards, а НЕ длину getDueCards(50): вторая упирается в
    // потолок раунда, и у кого 60 карточек, Главная писала 60, а «Практика» —
    // 50. Одно и то же число на двух экранах должно совпадать (ревью 2А).
    countDueCards(lang)
      .then((n) => alive && setDue(Math.min(n, 99)))
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
    countDueCards(lang).then((n) => setDue(Math.min(n, 99))).catch(() => {})
  }

  if (mode === 'review') return <DeckReview onBack={back} />
  if (mode !== 'hub') {
    return (
      <Suspense fallback={<Loading label="Готовим игру" />}>
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

  // Подпись у КАЖДОЙ плитки начинается с действия: «Выбери», «Впиши»,
  // «Соедини», «Собери». Ревью 1Б замерило, что «Пропущенное слово» и «Впиши
  // слово» неразличимы по названию, хотя в одном выбирают из вариантов, а в
  // другом печатают руками; «Значения» и «Быстрый перевод» тоже не сообщали,
  // что вообще делать. Глагол в первом слове снимает вопрос до тапа.
  const wordTiles: Tile[] = [
    { mode: 'match', Icon: IconMeaning, title: 'Значения', desc: 'Соедини пары' },
    { mode: 'gap', Icon: IconGap, title: 'Пропуск в предложении', desc: 'Выбери слово из четырёх' },
    { mode: 'translate', Icon: IconTranslate, title: 'Перевод слова', desc: 'Выбери перевод из четырёх' },
    { mode: 'listening', Icon: IconHeadphones, title: 'Аудирование', desc: 'Услышь и выбери' },
    { mode: 'sprint', Icon: IconTimer, title: 'Спринт', desc: 'Верно или нет · 60 секунд' },
    { mode: 'dictation', Icon: IconKeyboard, title: 'Диктант', desc: 'Услышь и впиши' },
    { mode: 'sentence', Icon: IconPuzzle, title: 'Собери фразу', desc: 'Собери из слов' },
  ]

  const mistakes = getMistakes(lang).length
  const grammarTiles: Tile[] = [
    { mode: 'gr-mcq', Icon: IconMcq, title: 'Выбери форму', desc: 'Выбери из вариантов' },
    { mode: 'gr-fill', Icon: IconPencil, title: 'Впиши форму', desc: 'Впечатай руками' },
    { mode: 'gr-order', Icon: IconRows, title: 'Собери предложение', desc: 'Расставь слова по порядку' },
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
    // «за диктором» — диктора нет, фразу читает синтез речи браузера
    { to: '/pronunciation', Icon: IconMic, title: 'Речь', desc: 'Слушай фразу и повторяй вслух' },
  ]

  const open = (t: Tile) => {
    if (t.mode) setMode(t.mode)
    else if (t.to) navigate(t.to)
  }

  const dueText =
    due === null
      ? 'Слова по расписанию'
      : due > 0
        ? `К повторению: ${due}`
        : words === 0
          ? 'Пока нет слов — добавь первые в Учёбе'
          : 'На сегодня всё повторено'

  const groups: PracticeGroup[] = [
    { id: 'review', title: 'Повторение', Icon: IconCards, hint: dueText, badge: due || undefined },
    { id: 'words', title: 'Слова', Icon: IconMeaning, hint: `${wordTiles.length} игры` },
    {
      id: 'grammar',
      title: 'Грамматика',
      Icon: IconMcq,
      hint: mistakes > 0 ? `Ошибок: ${mistakes}` : `${grammarTiles.length} режима`,
      badge: mistakes || undefined,
    },
    { id: 'speech', title: 'Речь', Icon: IconMic, hint: 'Проговори вслух' },
  ]
  const active: PracticeGroup = groups.find((g) => g.id === group) ?? groups[0]!
  const rest = groups.filter((g) => g.id !== active.id)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Практика</h1>

      {/* Абзац-инструкция отсюда убран (замер ревью 1Б: из-за него ни одна из
          13 плиток не была видна без прокрутки, а первым, что читал новичок,
          было предложение уйти в другой раздел). Подсказка осталась только там,
          где она нужна — когда слов действительно нет, и тогда это не совет,
          а кнопка. */}
      {words === 0 && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm text-[var(--night-text-70)]">
            Играть пока не с чем — сначала нужны слова.
          </p>
          <Button onClick={() => navigate('/study?view=words&sheet=packs')}>
            Взять готовый набор
          </Button>
        </Card>
      )}

      {/* Раскрытая группа. Раньше все тринадцать плиток лежали одним свитком:
          новичок видел стену одинаковых квадратов и не понимал, с чего начать.
          Теперь на экране один раскрытый раздел и три свёрнутых — идея
          MinimalCarousel из подборки владельца. Общее имя перехода (pg-*)
          заставляет браузер показать, как одна карточка выросла, а другая
          сжалась: те же элементы, а не подмена содержимого. */}
      <div
        className="animate-fade-up flex flex-col gap-3 rounded-3xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.16),rgba(145,132,217,.05))] p-4"
        style={{ viewTransitionName: `pg-${active.id}` }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
            <active.Icon size={24} />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-medium">{active.title}</span>
            <span className="block text-sm text-[var(--night-text-40)]">{active.hint}</span>
          </span>
        </div>

        {active.id === 'review' ? (
          <Button onClick={() => setMode('review')} className="w-full">
            {due && due > 0 ? `Повторить ${due}` : 'Открыть повторение'}
          </Button>
        ) : (
          <TileGrid
            tiles={
              active.id === 'words' ? wordTiles : active.id === 'grammar' ? grammarTiles : speechTiles
            }
            onOpen={open}
          />
        )}
      </div>

      {/* Свёрнутые разделы — рядом, в один ряд. */}
      <div className="grid grid-cols-3 gap-2.5">
        {rest.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            style={{ viewTransitionName: `pg-${g.id}` }}
            className="lift relative flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] px-2 py-3 text-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-[var(--night-text-70)]">
              <g.Icon size={20} />
            </span>
            <span className="text-[13px] font-medium leading-tight">{g.title}</span>
            {g.badge !== undefined && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--night-accent)] px-1.5 text-[11px] font-medium text-white">
                {g.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
