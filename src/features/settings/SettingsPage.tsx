// ============================================================================
// «Настройки» (роут /settings, вход из меню под аватаром).
// Профиль (имя, уровень английского) пишется в БД — RLS разрешает менять
// только эти колонки; скорость озвучки и размер текста в чтении хранятся
// локально (lib/settings.ts), у каждого устройства свои.
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconSpeaker, IconCheck } from '../../components/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { invalidateProfile } from '../../lib/profile'
import { speak } from '../../lib/speech'
import {
  SPEECH_RATES,
  getSettings,
  setSettings,
  type ReaderSize,
  type SpeechRate,
} from '../../lib/settings'
import { getEsLevel, setEsLevel } from '../../lib/esLevel'
import { Button } from '../../components/Button'
import type { CEFRLevel, Profile } from '../../types'

const LEVELS: CEFRLevel[] = ['A2', 'B1', 'B2', 'C1']

const SPEECH_LABELS: { id: SpeechRate; label: string }[] = [
  { id: 'slow', label: 'Медленно' },
  { id: 'normal', label: 'Обычно' },
  { id: 'fast', label: 'Быстро' },
]

const SIZE_LABELS: { id: ReaderSize; label: string }[] = [
  { id: 'small', label: 'Мелкий' },
  { id: 'normal', label: 'Обычный' },
  { id: 'large', label: 'Крупный' },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [level, setLevel] = useState<CEFRLevel | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState(getSettings)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const p = data as Profile | null
        setProfile(p)
        setName(p?.display_name ?? '')
        setLevel(lang === 'es' ? (getEsLevel() as CEFRLevel | null) : ((p?.level as CEFRLevel) ?? null))
      })
  }, [user, lang])

  const saveProfile = async () => {
    if (!user) return
    setError(null)
    try {
      const patch: Record<string, string> = {}
      const trimmed = name.trim()
      if (trimmed && trimmed !== profile?.display_name) patch.display_name = trimmed
      // уровень испанского живёт локально, английского — в профиле
      if (level) {
        if (lang === 'es') setEsLevel(level)
        else if (level !== profile?.level) patch.level = level
      }
      if (Object.keys(patch).length > 0) {
        const { error: e } = await supabase.from('profiles').update(patch).eq('id', user.id)
        if (e) throw e
        // сбросить кэш профиля — Главная и аватар-меню сразу увидят изменения
        invalidateProfile()
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  const patchLocal = (p: Partial<typeof local>) => setLocal(setSettings(p))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Назад"
          className="lift -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--night-text-70)]"
        >
          <IconBack size={20} />
        </button>
        <h1 className="text-2xl font-medium tracking-tight">Настройки</h1>
      </header>

      {/* Профиль */}
      <Section title="Профиль" delay=".05s">
        <label htmlFor="settings-name" className="block text-sm text-[var(--night-text-40)]">
          Как тебя зовут
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя"
          className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3.5 text-sm outline-none focus:border-[var(--night-accent-45)]"
        />

        <p className="mt-4 text-sm text-[var(--night-text-40)]">
          Мой уровень {lang === 'es' ? 'испанского' : 'английского'}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-medium transition-colors ${
                level === l
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.06] text-[var(--night-text-40)]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <Button className="mt-4 w-full py-2.5 text-sm" onClick={saveProfile}>
          {saved ? (
            <>
              <IconCheck size={16} /> Сохранено
            </>
          ) : (
            'Сохранить'
          )}
        </Button>
      </Section>

      {/* Озвучка */}
      <Section title="Озвучка" delay=".11s">
        <p className="text-sm text-[var(--night-text-40)]">
          Скорость чтения вслух — в карточках, текстах и упражнениях.
        </p>
        <div className="mt-2.5 flex gap-2">
          {SPEECH_LABELS.map((s) => (
            <button
              key={s.id}
              onClick={() => patchLocal({ speechRate: s.id })}
              className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-medium transition-colors ${
                local.speechRate === s.id
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.06] text-[var(--night-text-40)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            speak(lang === 'es' ? 'Hola, ¿cómo estás?' : 'This is how it sounds.', {
              lang,
              rate: SPEECH_RATES[local.speechRate],
            })
          }
          className="lift mt-3 flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.10] px-4 text-sm text-[var(--night-text-70)]"
        >
          <IconSpeaker size={16} /> Проверить
        </button>
      </Section>

      {/* Размер текста */}
      <Section title="Текст в чтении" delay=".17s">
        <p className="text-sm text-[var(--night-text-40)]">
          Размер шрифта в текстах раздела «Учёба».
        </p>
        <div className="mt-2.5 flex gap-2">
          {SIZE_LABELS.map((s) => (
            <button
              key={s.id}
              onClick={() => patchLocal({ readerSize: s.id })}
              className={`min-h-[44px] flex-1 rounded-xl px-3 font-medium transition-colors ${
                s.id === 'small' ? 'text-sm' : s.id === 'large' ? 'text-lg' : 'text-base'
              } ${
                local.readerSize === s.id
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.06] text-[var(--night-text-40)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      <p className="px-1 text-xs text-[var(--night-text-40)]">
        Скорость озвучки и размер текста сохраняются на этом устройстве.
        Имя и уровень — в аккаунте.
      </p>

      <p className="px-1 text-xs text-[var(--night-text-40)]">
        <a href="/terms" className="underline hover:text-[var(--night-text-70)]">
          Условия использования
        </a>{' '}
        ·{' '}
        <a href="/privacy" className="underline hover:text-[var(--night-text-70)]">
          Политика конфиденциальности
        </a>
      </p>
    </div>
  )
}

function Section({
  title,
  delay,
  children,
}: {
  title: string
  delay: string
  children: React.ReactNode
}) {
  return (
    <section
      className="animate-fade-up rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4"
      style={{ animationDelay: delay }}
    >
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  )
}
