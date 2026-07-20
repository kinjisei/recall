// ============================================================================
// Главная в теме «Nocturne».
// Порядок: приветствие → стрик-герой (с неделей) → новое задание учителя →
// «Начать занятие» → план на сегодня → слово дня → сданное задание/учитель.
// Данные берём из уже существующих источников: activity_log (стрик, неделя,
// сделанное сегодня) и FSRS (карточки к повторению, слово дня).
// ============================================================================
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FireIcon,
  PlayCircleIcon,
  CardsThreeIcon,
  BookOpenTextIcon,
  MicrophoneIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  LightbulbFilamentIcon,
  SpeakerHighIcon,
  CaretRightIcon,
  type Icon,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getStreak, getTodayTypes, getWeek, type WeekDay } from '../../lib/activity'
import { getDueCards } from '../../lib/fsrs'
import { getEsLevel } from '../../lib/esLevel'
import { startGuided } from '../../lib/guided'
import { speak } from '../../lib/speech'
import { RowCard } from '../../components/RowCard'
import { AssignmentsNotice, TeacherBlock } from '../teacher/TeacherBlock'
import type { ActivityType, Card as CardType, Profile } from '../../types'

interface PlanItem {
  to: string
  Icon: Icon
  title: string
  desc: string
  types: ActivityType[]
}

const planItems: PlanItem[] = [
  { to: '/flashcards', Icon: CardsThreeIcon, title: 'Слова', desc: 'Повторить и потренировать', types: ['flashcards', 'practice'] },
  { to: '/study', Icon: BookOpenTextIcon, title: 'Чтение', desc: 'Текст и новые слова', types: ['reader'] },
  { to: '/pronunciation', Icon: MicrophoneIcon, title: 'Речь', desc: 'Произношение вслух', types: ['pronunciation'] },
  { to: '/conversation', Icon: ChatCircleDotsIcon, title: 'Диалог', desc: 'Поговорить с AI', types: ['conversation', 'writing'] },
]

export function DashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState(0)
  const [week, setWeek] = useState<WeekDay[]>([])
  const [doneToday, setDoneToday] = useState<Set<ActivityType>>(new Set())
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [wordOfDay, setWordOfDay] = useState<CardType | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile | null))
    getStreak().then(setStreak).catch(() => {})
    getTodayTypes().then(setDoneToday).catch(() => {})
    getWeek().then(setWeek).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    setDueCount(null)
    setWordOfDay(null)
    getDueCards(99, lang)
      .then((d) => {
        setDueCount(d.length)
        setWordOfDay(d[0]?.card ?? null)
      })
      .catch(() => {})
  }, [user, lang])

  const name = profile?.display_name || user?.email?.split('@')[0] || 'друг'
  const esLevel = lang === 'es' ? getEsLevel() : null
  const level = lang === 'es' ? (esLevel ?? 'A1–A2') : (profile?.level ?? 'B1')
  const didToday = doneToday.size > 0

  const doneCount = planItems.filter((p) => p.types.some((t) => doneToday.has(t))).length
  const allDone = doneCount === planItems.length

  const dueLabel =
    dueCount === null
      ? 'Повторить и потренировать'
      : dueCount === 0
        ? 'Всё повторено ✨'
        : `К повторению: ${dueCount}${dueCount >= 99 ? '+' : ''}`

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Приветствие */}
      <header className="animate-fade-up">
        <h1 className="text-2xl font-medium tracking-tight">Привет, {name}</h1>
        <p className="mt-1 text-sm text-[var(--night-text-40)]">
          {lang === 'es' ? 'Испанский' : 'Английский'} · {level} ·{' '}
          {didToday ? 'сегодня уже занимался' : 'готов к практике?'}
        </p>
      </header>

      {/* 2. Стрик-герой */}
      <StreakHero streak={streak} week={week} didToday={didToday} />

      {/* 3. Новое задание от преподавателя */}
      <AssignmentsNotice placement="top" />

      {/* 4. Начать занятие */}
      <button
        onClick={() => navigate(startGuided())}
        className="lift animate-fade-up flex h-[58px] items-center justify-center gap-2.5 rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] font-medium text-[var(--night-text)]"
        style={{ animationDelay: '.12s' }}
      >
        <PlayCircleIcon size={22} weight="fill" className="text-[var(--night-accent-100)]" />
        <span className="flex flex-col items-start leading-tight">
          Начать занятие
          <span className="text-[11px] font-normal text-[var(--night-text-40)]">
            ~15 минут · слова → чтение → речь
          </span>
        </span>
      </button>

      {/* 5. План на сегодня */}
      <section className="animate-fade-up" style={{ animationDelay: '.18s' }}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium tracking-tight">План на сегодня</h2>
          <span className={`text-sm ${allDone ? 'text-[var(--night-accent-text)]' : 'text-[var(--night-text-40)]'}`}>
            {doneCount} из {planItems.length} готово
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {planItems.map((p, i) => {
            const done = p.types.some((t) => doneToday.has(t))
            return (
              <RowCard
                key={p.to}
                Icon={p.Icon}
                title={p.title}
                desc={done ? 'Готово · засчитано в серию' : p.to === '/flashcards' ? dueLabel : p.desc}
                to={p.to}
                muted={done}
                active={!done && i === 0}
                trailing={
                  done ? (
                    <CheckCircleIcon
                      size={20}
                      weight="fill"
                      className="flex-none text-[var(--night-accent)]"
                    />
                  ) : undefined
                }
                className="animate-fade-up"
                style={{ animationDelay: `${0.2 + i * 0.06}s` }}
              />
            )
          })}
        </div>
      </section>

      {/* 6. Слово дня */}
      {wordOfDay && <WordOfDay card={wordOfDay} lang={lang} />}

      {/* 7. Сданное задание уезжает вниз + блок преподавателя */}
      <AssignmentsNotice placement="bottom" />
      <TeacherBlock profile={profile} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function StreakHero({
  streak,
  week,
  didToday,
}: {
  streak: number
  week: WeekDay[]
  didToday: boolean
}) {
  const hint = didToday
    ? 'Сегодня засчитано — так держать!'
    : streak > 0
      ? 'Позанимайся, чтобы не потерять серию'
      : 'Занимайся каждый день — серия растёт'

  return (
    <div
      className="animate-fade-up relative overflow-hidden rounded-3xl border p-5"
      style={{
        background:
          'radial-gradient(140% 160% at 15% 0%, #2b2c55 0%, #1c1d38 55%, #171830 100%)',
        borderColor: 'rgba(145,132,217,.25)',
        animationDelay: '.06s',
      }}
    >
      {/* размытое акцентное пятно справа-сверху */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(145,132,217,.45), transparent 70%)' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--night-text-60)]">Серия дней подряд</p>
          <p className="mt-1.5 flex items-center gap-2.5">
            <FireIcon
              size={34}
              weight="fill"
              className="animate-flame text-[var(--night-accent-100)]"
            />
            <span className="animate-pop-in text-4xl font-medium tabular-nums">{streak}</span>
          </p>
        </div>
        <p className="max-w-[48%] pt-1 text-right text-sm leading-snug text-[var(--night-text-60)]">
          {hint}
        </p>
      </div>

      {/* неделя: 7 полосок */}
      <div className="relative mt-5 flex items-end gap-1.5">
        {week.map((d, i) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`animate-grow-bar h-1.5 w-full rounded-full ${
                d.active ? 'bg-[var(--night-accent)]' : 'bg-white/[0.09]'
              } ${d.isToday && !d.active ? 'ring-1 ring-[var(--night-accent-45)]' : ''}`}
              style={{ animationDelay: `${0.15 + i * 0.05}s` }}
            />
            <span
              className={`text-[10px] ${
                d.isToday ? 'text-[var(--night-accent-text)]' : 'text-[var(--night-text-40)]'
              }`}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <Link
        to="/progress"
        className="relative mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm text-[var(--night-accent-text)] hover:underline"
      >
        Мой прогресс <CaretRightIcon size={14} />
      </Link>
    </div>
  )
}

function WordOfDay({ card, lang }: { card: CardType; lang: 'en' | 'es' }) {
  const back = (card.back ?? '').split('·')[0].trim()
  return (
    <div
      className="animate-fade-up flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] px-4 py-3.5"
      style={{ animationDelay: '.45s' }}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
        <LightbulbFilamentIcon size={20} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
          Слово дня
        </p>
        <p className="truncate text-[15px] font-medium">
          {card.front}
          {back && <span className="text-[var(--night-text-40)]"> — {back}</span>}
        </p>
      </div>
      <button
        onClick={() => speak(card.front, { lang })}
        aria-label="Озвучить"
        className="lift flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/[0.08] text-[var(--night-text-70)]"
      >
        <SpeakerHighIcon size={18} />
      </button>
    </div>
  )
}
