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
import { supabase } from '../../lib/supabase'
import { getEsLevel } from '../../lib/esLevel'
import { getMyAssignments } from '../../lib/materials'
import { listMyQuests } from '../../lib/quests'
import { currentWeekIndex, getMyPlans } from '../../lib/studyPlan'
import type { StudyPlan } from '../../types'
import { currentGuidedStep } from '../../lib/guided'
import { ReaderPage } from '../reader/ReaderPage'
import { PacksSheet } from '../flashcards/PacksSheet'
import { AddCardForm } from '../words/AddCardForm'
import { DeckReview } from '../flashcards/DeckReview'

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
  const [esLevel, setEsLevel] = useState<string | null>(null)
  // null — уровень не задан; undefined — ещё грузится
  const [enLevel, setEnLevel] = useState<string | null | undefined>(undefined)
  const [assignments, setAssignments] = useState<{ total: number; pending: number } | null>(null)
  const [quests, setQuests] = useState<{ total: number; active: number } | null>(null)
  const [plans, setPlans] = useState<StudyPlan[] | null>(null)

  // уровень испанского хранится локально, английского — в профиле
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  useEffect(() => {
    if (lang !== 'en' || !user) return
    supabase
      .from('profiles')
      .select('level')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setEnLevel((data?.level as string | null) ?? null))
  }, [lang, user])

  useEffect(() => {
    getMyAssignments()
      .then((rows) =>
        setAssignments({
          total: rows.length,
          pending: rows.filter((r) => r.status === 'assigned').length,
        }),
      )
      .catch(() => setAssignments(null)) // строка просто не появится
    listMyQuests()
      .then((rows) =>
        setQuests({
          total: rows.length,
          active: rows.filter((r) => r.status === 'assigned').length,
        }),
      )
      .catch(() => setQuests(null)) // до выполнения SQL таблицы нет — строку прячем
    getMyPlans()
      .then(setPlans)
      .catch(() => setPlans(null)) // таблицы может ещё не быть — строку прячем
  }, [])

  if (view === 'reader') {
    return <ReaderPage title="Тексты и диалоги" onBack={() => setView('hub')} />
  }
  if (view === 'words') {
    return <WordsStudy onBack={() => setView('hub')} />
  }

  const level = lang === 'es' ? esLevel : (enLevel ?? null)
  const levelLoading = lang === 'en' && enLevel === undefined

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Учёба</h1>
      <p className="-mt-2 text-sm text-[var(--night-text-40)]">
        Тексты, грамматика и словарь — всё для изучения нового.
      </p>

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
          />
        )}
        <RowCard
          Icon={IconGap}
          title="Тексты и диалоги"
          desc={lang === 'es' ? 'Чтение с разбором слов · A1–B2' : 'Чтение с разбором слов · B1–C1'}
          onClick={() => setView('reader')}
          className="animate-fade-up"
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
          style={{ animationDelay: '.04s' }}
        />
        <RowCard
          Icon={IconCards}
          title="Слова"
          desc="Паки по уровням, свои слова и повторение"
          onClick={() => setView('words')}
          className="animate-fade-up"
          style={{ animationDelay: '.08s' }}
        />
        {!levelLoading && (
          <RowCard
            Icon={IconSparkle}
            title={level ? `Твой уровень: ${level}` : 'Определи свой уровень'}
            desc={
              level
                ? 'Пройти тест заново — вдруг уже вырос?'
                : `До ${lang === 'es' ? 40 : 50} вопросов — подстроим диалог и подсказки`
            }
            to="/placement"
            dashed={!level}
            className="animate-fade-up"
            style={{ animationDelay: '.12s' }}
          />
        )}
      </div>
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
