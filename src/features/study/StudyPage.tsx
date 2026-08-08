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
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useUrlState } from '../../lib/useUrlState'
import {
  IconGap,
  IconSparkle,
  IconPuzzle,
  IconGraduation,
  IconRows,
  IconMaterials,
  IconPencil,
  IconPlus,
  IconCards,
  IconPackage,
} from '../../components/icons'
import { RowCard } from '../../components/RowCard'
import { LoadError } from '../../components/LoadError'
import { BackHeader } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getProfile, getCachedEnLevel } from '../../lib/profile'
import { getEsLevel } from '../../lib/esLevel'
import { getMyAssignments } from '../../lib/materials'
import { countMyWritingTasks } from '../../lib/writing'
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
  // Внутренний экран — в адресе (?view=reader), а не в useState: иначе «назад»
  // и свайп на телефоне уводили сразу на Главную мимо хаба, а F5 терял место.
  // Общее правило и оговорки — в lib/useUrlState.ts.
  const [rawView, setRawView] = useUrlState('view', (v) => v === 'reader' || v === 'words')
  const view: View = (rawView as View | null) ?? 'hub'
  const setView = (v: View) => setRawView(v === 'hub' ? null : v)
  // ведомая сессия «Начать занятие» открывает чтение сразу
  useEffect(() => {
    if (view === 'hub' && currentGuidedStep() === 'reader') setRawView('reader')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // переход хаб ↔ читалка ↔ слова — всегда с верха экрана
  useScrollTop(view)
  // повторный тап по вкладке «Учёба» (BottomNav шлёт событие) → назад к хабу
  useEffect(() => {
    const reset = (e: Event) => {
      if ((e as CustomEvent).detail === '/study') setView('hub')
    }
    window.addEventListener('recall:reset-tab', reset)
    return () => window.removeEventListener('recall:reset-tab', reset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [esLevel, setEsLevel] = useState<string | null>(null)
  // мгновенный старт из localStorage-кэша: undefined только на самом первом
  // запуске устройства — строка «Твой уровень» больше не мигает с задержкой
  const [enLevel, setEnLevel] = useState<string | null | undefined>(() => getCachedEnLevel())
  // все async-строки хаба (задания/квесты/программа) приходят ОДНИМ пакетом —
  // иначе они вываливались вразнобой без анимации (жалоба владельца)
  const [hub, setHub] = useState<{
    assignments: { total: number; pending: number } | null
    writing: { total: number; pending: number } | null
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

  // Сколько входов не ответило: если не ответил НИ ОДИН, это почти наверняка
  // потеря связи, а не «у тебя ничего не назначено». Раньше строки заданий,
  // квестов и программы в офлайне просто исчезали — человек думал, что учитель
  // ничего не давал (находка ревью 1Г).
  const [failed, setFailed] = useState(0)

  const loadHub = useCallback(() => {
    setHub(null)
    setFailed(0)
    let failures = 0
    const miss = () => {
      failures++
      return null
    }
    // ⚠️ Ждём не бесконечно. Живая проба с заблокированной базой показала, что
    // при недоступном сервере запросы не отвечают ВООБЩЕ (клиент Supabase
    // уходит в свои повторы), и хаб навсегда застывал на скелетонах — человек
    // смотрел на серые прямоугольники, не понимая, чего ждёт. Через 12 секунд
    // показываем что есть и честно говорим про связь.
    const withTimeout = <T,>(p: Promise<T>): Promise<T | null> =>
      Promise.race([
        p,
        new Promise<null>((resolve) =>
          setTimeout(() => {
            failures++
            resolve(null)
          }, 12_000),
        ),
      ])

    return Promise.all([
      withTimeout(
        getMyAssignments()
          .then((rows) => ({
            total: rows.length,
            pending: rows.filter((r) => r.status === 'assigned').length,
          }))
          .catch(miss),
      ),
      withTimeout(countMyWritingTasks().catch(miss)),
      withTimeout(
        listMyQuests()
          .then((rows) => ({
            total: rows.length,
            active: rows.filter((r) => r.status === 'assigned').length,
          }))
          .catch(miss),
      ),
      withTimeout(getMyPlans().catch(miss)),
      // назначил ли преподаватель тест уровня по текущему языку
      withTimeout(myPendingPlacement(lang).catch(miss)),
    ]).then(([assignments, writing, quests, plans, placement]) => {
      setHub({ assignments, writing, quests, plans, placement })
      setFailed(failures)
    })
  }, [lang])

  useEffect(() => {
    void loadHub()
  }, [loadHub])

  if (view === 'reader') {
    return <ReaderPage title="Тексты и диалоги" onBack={() => setView('hub')} />
  }
  if (view === 'words') {
    return <WordsStudy onBack={() => setView('hub')} />
  }

  const level = lang === 'es' ? esLevel : (enLevel ?? null)
  const levelLoading = lang === 'en' && enLevel === undefined

  const assignments = hub?.assignments ?? null
  const writing = hub?.writing ?? null
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
          {/* Хотя бы один вход не ответил — картина неполная, и молчать нельзя:
              человек решит, что преподаватель ничего не назначал.
              ⚠️ Условие «упали ВСЕ пять» не годилось: часть функций гасит ошибку
              внутри себя и возвращает пустоту, поэтому счётчик до пяти не
              доходил и плашка не показывалась (поймано живой пробой с
              заблокированной базой). */}
          {failed > 0 && (
            <LoadError
              message="Часть разделов не загрузилась — похоже, пропала связь. Тексты и грамматика ниже работают и без интернета."
              onRetry={() => void loadHub()}
            />
          )}
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
          {writing && writing.total > 0 && (
            <RowCard
              Icon={IconPencil}
              title="Письменные задания"
              desc={
                writing.pending > 0
                  ? `Новых: ${writing.pending} · всего ${writing.total}`
                  : 'Все сданы · можно пересдать'
              }
              to="/writing"
              active={writing.pending > 0}
              trailing={
                writing.pending > 0 ? (
                  <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
                    {writing.pending}
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
                // plans.length > 0 уже проверено условием рендера строки выше —
                // p гарантирован; guard явный для noUncheckedIndexedAccess.
                if (!p) return ''
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
          {/* «Мой словарь», а не «Слова»: во вкладке «Практика» есть своя секция
              «Слова» — с играми. Одно и то же название для управления словами и
              для тренировок заставляло гадать, куда идти (находка ревью 1Б).
              Здесь — мои слова и наборы, там — тренировки на них. */}
          <RowCard
            Icon={IconCards}
            title="Мой словарь"
            desc="Наборы по уровням, свои слова, список выученного"
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
  // подэкран — тоже в адресе (?sub=review): «назад» из повторения должен
  // возвращать в «Слова», а не выбрасывать из «Учёбы» целиком
  const [rawSub, setRawSub] = useUrlState('sub', (v) => v === 'review' || v === 'mywords')
  const sub = (rawSub as 'review' | 'mywords' | null) ?? 'menu'
  const setSub = (s: 'menu' | 'review' | 'mywords') => setRawSub(s === 'menu' ? null : s)
  // Открытая шторка — тоже в адресе (?sheet=packs). Нужна не ради истории, а
  // чтобы на неё можно было ПРИВЕСТИ: пустая колода зовёт «Добавить первые
  // слова», и человек должен попасть сразу к наборам, а не в общий список.
  const [sheet, setSheet] = useUrlState('sheet', (v) => v === 'packs' || v === 'add')
  // «Мои слова» — длинный список: без сброса открывался на прежней прокрутке меню
  useScrollTop(sub)

  // ⚠️ Сброс — только при РЕАЛЬНОЙ смене языка: эффект с [lang] срабатывает и
  // на первом рендере, а это стёрло бы ?sub= из прямой ссылки.
  const prevLang = useRef(lang)
  useEffect(() => {
    if (prevLang.current !== lang) {
      prevLang.current = lang
      setSub('menu')
      setSheet(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // Кнопки «Повторение» здесь больше нет (см. ниже), но ссылку ?sub=review
  // оставляем рабочей: она могла остаться в закладке или в истории, и лучше
  // открыть ожидаемый экран, чем чужой.
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
      <BackHeader onBack={onBack} title="Мой словарь" />

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="px-3 py-2 text-sm"
          onClick={() => setSheet(sheet === 'packs' ? null : 'packs')}
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
          onClick={() => setSheet(sheet === 'add' ? null : 'add')}
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
          Icon={IconRows}
          title="Мои слова"
          desc="Список, поиск, правка, статусы"
          onClick={() => setSub('mywords')}
          className="animate-fade-up"
        />
      </div>

      {/* Повторение отсюда убрано: тот же экран открывался и во вкладке
          «Практика», только разным числом тапов, и ничто не подсказывало, куда
          идти (замер ревью 1Б: 3 тапа против 2). Теперь у каждой вкладки одна
          роль — здесь слова собирают, там на них тренируются, — а вместо
          спрятанного дубля стоит указатель. */}
      <p className="text-sm text-[var(--night-text-40)]">
        Повторение и игры на этих словах — во вкладке «Практика».
      </p>
    </div>
  )
}
