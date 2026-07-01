import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import type { Profile } from '../../types'

const sessionBlocks = [
  { to: '/flashcards', icon: '🎴', title: 'Колода', desc: 'Повторить слова' },
  { to: '/reader', icon: '📖', title: 'Ввод', desc: 'Почитать текст' },
  { to: '/pronunciation', icon: '🎙', title: 'Речь', desc: 'Потренировать произношение' },
  { to: '/conversation', icon: '💬', title: 'Диалог', desc: 'Поговорить с AI' },
]

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile | null))
  }, [user])

  const name = profile?.display_name || user?.email?.split('@')[0] || 'друг'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Привет, {name}! 👋</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Уровень: {profile?.level ?? '—'} · готов к сегодняшней практике?
          </p>
        </div>
        <Button variant="ghost" onClick={signOut} className="px-3 py-2 text-sm">
          Выйти
        </Button>
      </header>

      {/* Стрик — пока заглушка, наполнит Фаза 3 */}
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Серия дней подряд
          </p>
          <p className="text-3xl font-bold">🔥 0</p>
        </div>
        <p className="max-w-[55%] text-right text-sm text-slate-500 dark:text-slate-400">
          Занимайся каждый день — серия будет расти
        </p>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Сегодняшняя сессия</h2>
        <div className="grid grid-cols-2 gap-3">
          {sessionBlocks.map((b) => (
            <Link key={b.to} to={b.to}>
              <Card className="h-full transition-transform active:scale-95">
                <div className="text-3xl">{b.icon}</div>
                <div className="mt-2 font-semibold">{b.title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {b.desc}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
