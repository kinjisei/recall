// ============================================================================
// «Учёба» (роут /study) — хаб изучения, как в макете «Nocturne»: строки-входы,
// контент за тапом (никаких списков сразу и никаких прыжков в другие вкладки):
//   Задания от преподавателя (если есть)
//   Тексты и диалоги  → читалка (ReaderPage, внутренний экран)
//   Грамматика        → /grammar (уроки + глаголы)
//   Слова             → внутренний экран: паки, +слово, мои слова, колода
//   Твой уровень      → /placement (доступен всегда)
// Ведомая сессия «Начать занятие» открывает читалку сразу (?view=reader).
// ============================================================================
import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconGap,
  IconSparkle,
  IconPuzzle,
  IconGraduation,
  IconRows,
  IconMaterials,
  IconPlus,
  IconCards,
  IconPackage,
} from '../../components/icons'
import { RowCard } from '../../components/RowCard'
import { BackHeader } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getProfile, getCachedEnLevel } from '../../lib/profile'
import { getEsLevel } from '../../lib/esLevel'
import { getMyAssignments } from '../../lib/materials'
import { listMyQuests } from '../../lib/quests'
import { currentWeekIndex, getMyPlans } from '../../lib/studyPlan'
import { myPendingPlacement, type PlacementRequest } from '../../lib/placement'
import type { StudyPlan } from '../../types'
import { currentGuidedStep } from '../../lib/guided'
import { ReaderPage } from '../reader/ReaderPage'
import { PacksSheet } from '../flashcards/PacksSheet'
import { AddCardForm } from '../words/AddCardForm'
import { DeckReview } from '../flashcards/DeckReview'
import { useScrollTop } from '../../lib/useScrollTop'

const MyWords = lazy(() => import('../words/MyWords').then((m) => ({ default: m.MyWords })))

type View = 'hub' | 'reader' | 'words'

export function StudyPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [params] = useSearchParams()
  // ведомая сессия или прямая ссылка ?view=reader — сразу к текстам
  const [view, setView] = useState<View>(() =>
    params.get('view') === 'reader' || currentGuidedStep() === 'reader' ? 'reader' : 'hub',
  )
  // переход хаб ↔ читалка ↔ слова — всегда с верха экрана
  useScrollTop(view)
  const [esLevel, setEsLevel] = useState<string | null>(null)
  // мгновенный старт из localStorage-кэша: undefined только на самом первом
  // запуске устройства — строка «Твой уровень» больше не мигает с задержкой
  const [enLevel, setEnLevel] = useState<string | null | undefined>(() => getCachedEnLevel())
  // все async-строки хаба (задания/квесты/программа) приходят ОДНИМ пакетом —
  // иначе они вываливались вразнобой без анимации (жалоба владельца)
  const [hub, setHub] = useState<{
    assignments: { total: number; pending: number } | null
    quests: { total: number; active: number } | null
    plans: StudyPlan[] | null
    /** Тест уровня, назначенный преподавателем (null — не назначал). */
    placement: PlacementRequest | null
  } | null>(null)

  // уровень испанского хранится локально, английского — в профиле
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  useEffect(() => {
    if (lang !== 'en' || !user) return
    // тихое обновление из профиля (кэш lib/profile; заодно освежает localStorage)
    getProfile(user.id).then((p) => setEnLevel(p?.level ?? null))
  }, [lang, user])

  useEffect(() => {
    let alive = true
    Promise.all([
      getMyAssignments()
        .then((rows) => ({
          total: rows.length,
          pending: rows.filter((r) => r.status === 'assigned').length,
        }))
        .catch(() => null), // строка просто не появится
      listMyQuests()
        .then((rows) => ({
          total: rows.length,
          active: rows.filter((r) => r.status === 'assigned').length,
        }))
        .catch(() => null),
      getMyPlans().catch(() => null),
      // назначил ли преподаватель тест уровня по текущему языку
      myPendingPlacement(lang).catch(() => null),
    ]).then(([assignments, quests, plans, placement]) => {
      if (alive) setHub({ assignments, quests, plans, placement })
    })
    return () => {
      alive = false
    }
  }, [lang])

  if (view === 'reader') {
    return <ReaderPage title="Тексты и диалоги" onBack={() => setView('hub')} />
  }
  if (view === 'words') {
    return <WordsStudy onBack={() => setView('hub')} />
  }

  const level = lang === 'es' ? esLevel : (enLevel ?? null)
  const levelLoading = lang === 'en' && enLevel === undefined

  const assignments = hub?.assignments ?? null
  const quests = hub?.quests ?? null
  const plans = hub?.plans ?? null
  // единый stagger: задержка растёт по ПОЗИЦИИ строки, какие бы строки ни были
  let rowIndex = 0
  const stagger = () => ({ animationDelay: `${rowIndex++ * 0.05}s` })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Учёба</h1>
      <p className="-mt-2 text-sm text-[var(--night-text-40)]">
        Тексты, грамматика и словарь — всё для изучения нового.
      </p>

      {hub === null ? (
        // скелетоны высоты RowCard — без прыжков вёрстки, пока грузятся строки
        <div className="flex flex-col gap-2.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignments && assignments.total > 0 && (
            <RowCard
              Icon={IconMaterials}
              title="Задания от преподавателя"
              desc={
                assignments.pending > 0
                  ? `Новых: ${assignments.pending} · всего ${assignments.total}`
                  : `Все выполнены · можно потренироваться ещё раз`
              }
              to="/assignments"
              active={assignments.pending > 0}
              trailing={
                assignments.pending > 0 ? (
                  <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
                    {assignments.pending}
                  </span>
                ) : undefined
              }
              className="animate-fade-up"
              style={stagger()}
            />
          )}
          {quests && quests.total > 0 && (
            <RowCard
              Icon={IconPuzzle}
              title="AI-квесты"
              desc={
                quests.active > 0
                  ? `Активных: ${quests.active} — AI ждёт твоего хода`
                  : 'Все квесты пройдены ✓'
              }
              to="/quests"
              active={quests.active > 0}
              trailing={
                quests.active > 0 ? (
                  <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
                    {quests.active}
                  </span>
                ) : undefined
              }
              className="animate-fade-up"
              style={stagger()}
            />
          )}
          {plans && plans.length > 0 && (
            <RowCard
              Icon={IconRows}
              title="Моя программа"
              desc={(() => {
                const p = plans.find((x) => x.lang === lang) ?? plans[0]
                return `Неделя ${currentWeekIndex(p)} из ${p.weeks.length} — план от преподавателя`
              })()}
              to="/program"
              active
              className="animate-fade-up"
              style={stagger()}
            />
          )}
          <RowCard
            Icon={IconGap}
            title="Тексты и диалоги"
            desc={lang === 'es' ? 'Чтение с разбором слов · A1–B2' : 'Чтение с разбором слов · B1–C1'}
            onClick={() => setView('reader')}
            className="animate-fade-up"
            style={stagger()}
          />
          <RowCard
            Icon={IconGraduation}
            title="Грамматика"
            desc={
              lang === 'es'
                ? 'Уроки A1–B2 и спряжения глаголов'
                : 'Уроки A1–C1 и неправильные глаголы'
            }
            to="/grammar"
            className="animate-fade-up"
            style={stagger()}
          />
          <RowCard
            Icon={IconCards}
            title="Слова"
            desc="Паки по уровням, свои слова и повторение"
            onClick={() => setView('words')}
            className="animate-fade-up"
            style={stagger()}
          />
          {!levelLoading && (
            <RowCard
              Icon={IconSparkle}
              // просьба преподавателя важнее собственного любопытства — она и
              // в заголовке, и строка становится пунктирной (как «есть дело»)
              title={
                hub?.placement
                  ? 'Преподаватель просит пройти тест уровня'
                  : level
                    ? `Твой уровень: ${level}`
                    : 'Определи свой уровень'
              }
              desc={
                hub?.placement
                  ? 'Результат увидит преподаватель — по нему подберёт материалы'
                  : level
                    ? 'Пройти тест заново — вдруг уже вырос?'
                    : `До ${lang === 'es' ? 40 : 50} вопросов — подстроим диалог и подсказки`
              }
              to="/placement"
              dashed={!level || !!hub?.placement}
              className="animate-fade-up"
              style={stagger()}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// «Слова» — изучение лексики: паки, добавление своих слов, список, колода.
// (Игры на этих словах — во вкладке «Практика».)
// ---------------------------------------------------------------------------

function WordsStudy({ onBack }: { onBack: () => void }) {
  const { lang } = useLanguage()
  const [sub, setSub] = useState<'menu' | 'review' | 'mywords'>('menu')
  const [sheet, setSheet] = useState<null | 'add' | 'packs'>(null)

  useEffect(() => {
    setSub('menu')
    setSheet(null)
  }, [lang])

  if (sub === 'review') return <DeckReview onBack={() => setSub('menu')} />
  if (sub === 'mywords') {
    return (
      <Suspense fallback={<p className="text-[var(--night-text-40)]">Загрузка…</p>}>
        <MyWords lang={lang} onBack={() => setSub('menu')} />
      </Suspense>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title="Слова" />

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
              <IconPackage size={16} /> Паки слов
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
              <IconPlus size={16} /> Своё слово
            </>
          )}
        </Button>
      </div>

      {sheet === 'add' && <AddCardForm lang={lang} onAdded={() => {}} />}
      {sheet === 'packs' && <PacksSheet lang={lang} onAdded={() => {}} />}

      <div className="flex flex-col gap-2.5">
        <RowCard
          Icon={IconCards}
          title="Повторение слов"
          desc="Повторяем слова, пока не забылись — приложение само напоминает вовремя"
          onClick={() => setSub('review')}
          active
          className="animate-fade-up"
        />
        <RowCard
          Icon={IconRows}
          title="Мои слова"
          desc="Список, поиск, правка, статусы"
          onClick={() => setSub('mywords')}
          className="animate-fade-up"
          style={{ animationDelay: '.05s' }}
        />
      </div>
    </div>
  )
}
