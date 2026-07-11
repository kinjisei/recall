import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getStreak, getTodayTypes } from '../../lib/activity'
import { getDueCards } from '../../lib/fsrs'
import { getEsLevel } from '../../lib/esLevel'
import { Card } from '../../components/Card'
import {
  IconFlame,
  IconLogout,
  IconDeck,
  IconBook,
  IconMic,
  IconGrammar,
  IconGamepad,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconSparkles,
} from '../../components/icons'
import { TeacherBlock } from '../teacher/TeacherBlock'
import type { ActivityType, Profile } from '../../types'

type Tone = 'sky' | 'violet' | 'rose' | 'amber' | 'emerald' | 'cyan'

interface SessionBlock {
  to: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: Tone
  title: string
  desc: string
  types: ActivityType[]
  esOnly?: boolean
}

const toneChip: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400',
}

const sessionBlocks: SessionBlock[] = [
  { to: '/flashcards', Icon: IconDeck, tone: 'sky', title: 'Колода', desc: 'Повторить слова', types: ['flashcards'] },
  { to: '/reader', Icon: IconBook, tone: 'violet', title: 'Ввод', desc: 'Почитать текст', types: ['reader'] },
  { to: '/pronunciation', Icon: IconMic, tone: 'rose', title: 'Речь', desc: 'Произношение', types: ['pronunciation'] },
  { to: '/grammar', Icon: IconGrammar, tone: 'amber', title: 'Грамматика', desc: 'Урок + упражнения', types: ['grammar'] },
  { to: '/practice', Icon: IconGamepad, tone: 'emerald', title: 'Практика', desc: 'Мини-игры', types: ['practice'], esOnly: true },
  { to: '/conversation', Icon: IconChat, tone: 'cyan', title: 'Диалог', desc: 'Поговорить с AI', types: ['conversation', 'writing'] },
]

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const { lang } = useLanguage()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState<number>(0)
  const [doneToday, setDoneToday] = useState<Set<ActivityType>>(new Set())
  const [dueCount, setDueCount] = useState<number | null>(null)

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
  }, [user])

  useEffect(() => {
    if (!user) return
    setDueCount(null)
    getDueCards(99, lang).then((d) => setDueCount(d.length)).catch(() => {})
  }, [user, lang])

  const name = profile?.display_name || user?.email?.split('@')[0] || 'друг'
  const didSomethingToday = doneToday.size > 0
  const esLevel = lang === 'es' ? getEsLevel() : null

  const streakHint = didSomethingToday
    ? 'Сегодня засчитано — так держать!'
    : streak > 0
      ? 'Сделай упражнение, чтобы не потерять серию'
      : 'Занимайся каждый день — серия растёт'

  const flashcardsDesc =
    dueCount === null
      ? 'Повторить слова'
      : dueCount === 0
        ? 'Всё повторено ✨'
        : `К повторению: ${dueCount}${dueCount >= 99 ? '+' : ''}`

  const blocks = sessionBlocks.filter((b) => !b.esOnly || lang === 'es')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Привет, {name}! 👋</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {lang === 'es'
              ? `Испанский · ${esLevel ?? 'A1–A2'}`
              : `Английский · ${profile?.level ?? '—'}`}{' '}
            · готов к практике?
          </p>
        </div>
        <button
          onClick={signOut}
          aria-label="Выйти"
          className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <IconLogout className="h-5 w-5" />
        </button>
      </header>

      {/* Стрик-герой */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white shadow-md shadow-sky-600/25">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/80">Серия дней подряд</p>
            <p className="mt-1 flex items-center gap-2 text-4xl font-bold tabular-nums">
              <IconFlame className="h-8 w-8" />
              {streak}
            </p>
          </div>
          <p className="max-w-[52%] text-right text-sm text-white/90">{streakHint}</p>
        </div>
      </div>

      {/* Тест уровня — показываем в ES-режиме, пока уровень не определён */}
      {lang === 'es' && !esLevel && (
        <Link to="/placement" className="focus-visible:outline-none">
          <Card interactive className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <IconSparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Определи свой уровень</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Короткий тест A1–B2 — подстроит «Диалог» под тебя
              </p>
            </div>
            <IconChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </Card>
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Сегодняшняя сессия</h2>
        <div className="grid grid-cols-2 gap-3">
          {blocks.map((b) => {
            const done = b.types.some((t) => doneToday.has(t))
            return (
              <Link key={b.to} to={b.to} className="focus-visible:outline-none">
                <Card interactive className="relative flex h-full flex-col">
                  {done && (
                    <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <IconCheck className="h-3 w-3" /> готово
                    </span>
                  )}
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneChip[b.tone]}`}>
                    <b.Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-3 font-semibold">{b.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {b.to === '/flashcards' ? flashcardsDesc : b.desc}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <TeacherBlock profile={profile} />
    </div>
  )
}
