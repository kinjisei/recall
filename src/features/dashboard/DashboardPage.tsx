import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getStreak, getTodayTypes } from '../../lib/activity'
import { getDueCards } from '../../lib/fsrs'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import type { ActivityType, Profile } from '../../types'

const sessionBlocks: {
  to: string
  icon: string
  title: string
  desc: string
  types: ActivityType[]
}[] = [
  { to: '/flashcards', icon: '🎴', title: 'Колода', desc: 'Повторить слова', types: ['flashcards'] },
  { to: '/reader', icon: '📖', title: 'Ввод', desc: 'Почитать текст', types: ['reader'] },
  { to: '/pronunciation', icon: '🎙', title: 'Речь', desc: 'Потренировать произношение', types: ['pronunciation'] },
  { to: '/conversation', icon: '💬', title: 'Диалог', desc: 'Поговорить с AI', types: ['conversation', 'writing'] },
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

  // Счётчик «к повторению» — по колодам выбранного языка.
  useEffect(() => {
    if (!user) return
    setDueCount(null)
    getDueCards(99, lang).then((d) => setDueCount(d.length)).catch(() => {})
  }, [user, lang])

  const name = profile?.display_name || user?.email?.split('@')[0] || 'друг'
  const didSomethingToday = doneToday.size > 0

  const streakHint = didSomethingToday
    ? 'Сегодня засчитано — так держать!'
    : streak > 0
      ? 'Сделай хотя бы одно упражнение, чтобы не потерять серию'
      : 'Занимайся каждый день — серия будет расти'

  const flashcardsDesc =
    dueCount === null
      ? 'Повторить слова'
      : dueCount === 0
        ? 'Всё повторено ✨'
        : `К повторению: ${dueCount}${dueCount >= 99 ? '+' : ''}`

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Привет, {name}! 👋</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {lang === 'es'
              ? 'Испанский · A1–A2 · готов к сегодняшней практике?'
              : `Английский · ${profile?.level ?? '—'} · готов к сегодняшней практике?`}
          </p>
        </div>
        <Button variant="ghost" onClick={signOut} className="px-3 py-2 text-sm">
          Выйти
        </Button>
      </header>

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Серия дней подряд
          </p>
          <p className="text-3xl font-bold">🔥 {streak}</p>
        </div>
        <p className="max-w-[55%] text-right text-sm text-slate-500 dark:text-slate-400">
          {streakHint}
        </p>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Сегодняшняя сессия</h2>
        <div className="grid grid-cols-2 gap-3">
          {sessionBlocks.map((b) => {
            const done = b.types.some((t) => doneToday.has(t))
            return (
              <Link key={b.to} to={b.to}>
                <Card className="relative h-full transition-transform active:scale-95">
                  {done && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      ✓ сделано
                    </span>
                  )}
                  <div className="text-3xl">{b.icon}</div>
                  <div className="mt-2 font-semibold">{b.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {b.to === '/flashcards' ? flashcardsDesc : b.desc}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
