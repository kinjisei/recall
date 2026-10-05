// ============================================================================
// «Настройки» (роут /settings, вход из меню под аватаром).
// Профиль (имя, уровень английского) пишется в БД — RLS разрешает менять
// только эти колонки; скорость озвучки и размер текста в чтении хранятся
// локально (lib/settings.ts), у каждого устройства свои.
// ============================================================================
import { useEffect, useState } from 'react'

import { SecuritySection } from './SecuritySection'
import { LessonReminders } from './LessonReminders'
import { SUPPORT_EMAIL, SUPPORT_SLA, supportMailto } from '../../shared/lib/contacts'
import { IconSpeaker, IconCheck, IconThumbsUp } from '../../shared/ui/icons'
import { BackButton } from '../../shared/ui/BackButton'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../shared/api/supabase'
import type { TablesUpdate } from '../../shared/api/database.types'
import { invalidateProfile, selectProfiles } from '../../lib/profile'
import { speak } from '../../lib/speech'
import {
  SPEECH_RATES,
  getSettings,
  setSettings,
  type ReaderSize,
  type SpeechRate,
} from '../../lib/settings'
import { getEsLevel, setEsLevel } from '../../lib/esLevel'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup, type ChoiceOption } from '../../shared/ui/ChoiceGroup'
import type { CEFRLevel, Profile } from '../../types'
import { AppLink } from '../../shared/ui/AppLink'
import { FeedbackSheet } from '../../components/FeedbackSheet'
import { LoadError } from '../../shared/ui/LoadError'

// A1 включён: тест уровня может дать A1, и без кнопки его нельзя было выбрать —
// у пользователя с уровнем A1 не подсвечивалась ни одна кнопка, а сохранение
// затирало его на случайно нажатый уровень
const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

const SPEECH_LABELS: { id: SpeechRate; label: string }[] = [
  { id: 'slow', label: 'Медленно' },
  { id: 'normal', label: 'Обычно' },
  { id: 'fast', label: 'Быстро' },
]

// размер шрифта варианта — прямо в подписи, чтобы выбор был виден заранее
const SIZE_LABELS: ChoiceOption<ReaderSize>[] = [
  { id: 'small', label: 'Мелкий', className: 'text-sm' },
  { id: 'normal', label: 'Обычный', className: 'text-base' },
  { id: 'large', label: 'Крупный', className: 'text-lg' },
]
const LEVEL_OPTIONS: ChoiceOption<CEFRLevel>[] = LEVELS.map((l) => ({ id: l, label: l }))

export function SettingsPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [level, setLevel] = useState<CEFRLevel | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState(getSettings)
  const [feedback, setFeedback] = useState(false)
  // Профиль не загрузился (нет связи) — формы нет: пустые имя и уровень,
  // сохранённые после возврата связи, затёрли бы настоящие (PLAN.md Ф1.13).
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    void selectProfiles<Profile>((cols) =>
      supabase.from('profiles').select(cols).eq('id', user.id).single() as never,
    )
      .then(({ data, error: e }) => {
        // PGRST116 — ряда нет: это не сбой связи, форма остаётся
        const failed = Boolean(e) && e?.code !== 'PGRST116'
        setLoadFailed(failed)
        if (failed) return
        const p = data as Profile | null
        setProfile(p)
        setName(p?.display_name ?? '')
        setLevel(lang === 'es' ? (getEsLevel() as CEFRLevel | null) : ((p?.level as CEFRLevel) ?? null))
      })
  }, [user, lang, attempt])

  const saveProfile = async () => {
    if (!user) return
    setError(null)
    try {
      const patch: TablesUpdate<'profiles'> = {}
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
        <BackButton fallback="/" />
        <h1 className="text-2xl font-medium tracking-tight">Настройки</h1>
      </header>

      {/* Профиль */}
      {loadFailed ? (
        <LoadError
          message="Профиль не загрузился — похоже, пропала связь."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
      <Section title="Профиль" delay=".05s">
        <label htmlFor="settings-name" className="block text-sm text-fg-muted">
          Как тебя зовут
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя"
          className="mt-1.5 h-11 w-full rounded-xl border border-tint/[0.10] bg-input px-3.5 text-sm outline-none focus:border-accent-line"
        />

        <p className="mt-4 text-sm text-fg-muted">
          Мой уровень {lang === 'es' ? 'испанского' : 'английского'}
        </p>
        <ChoiceGroup
          label="Мой уровень"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={setLevel}
          className="mt-1.5"
        />

        {error && <p className="mt-3 text-sm text-danger-strong">{error}</p>}

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
      )}

      {/* Уведомления об уроках (Ф2.9, макет u4-1) — только ученику с преподавателем */}
      <LessonReminders />

      {/* Озвучка */}
      <Section title="Озвучка" delay=".11s">
        <p className="text-sm text-fg-muted">
          Скорость чтения вслух — в карточках, текстах и упражнениях.
        </p>
        <ChoiceGroup
          label="Скорость озвучки"
          options={SPEECH_LABELS}
          value={local.speechRate}
          onChange={(id) => patchLocal({ speechRate: id })}
          stretch
          className="mt-2.5"
        />
        <button
          onClick={() =>
            speak(lang === 'es' ? 'Hola, ¿cómo estás?' : 'This is how it sounds.', {
              lang,
              rate: SPEECH_RATES[local.speechRate],
            })
          }
          className="lift mt-3 flex min-h-[44px] items-center gap-2 rounded-full border border-tint/[0.10] px-4 text-sm text-fg-secondary shadow-card"
        >
          <IconSpeaker size={16} /> Проверить
        </button>
      </Section>

      {/* Размер текста */}
      <Section title="Текст в чтении" delay=".17s">
        <p className="text-sm text-fg-muted">
          Размер шрифта в текстах раздела «Учёба».
        </p>
        <ChoiceGroup
          label="Размер текста в чтении"
          options={SIZE_LABELS}
          value={local.readerSize}
          onChange={(id) => patchLocal({ readerSize: id })}
          stretch
          className="mt-2.5"
        />
      </Section>

      {/* Безопасность — отдельным файлом: форма со своим состоянием и
          проверкой текущего пароля, в общий экран настроек её мешать незачем. */}
      <SecuritySection />

      <p className="px-1 text-xs text-fg-muted">
        Скорость озвучки и размер текста сохраняются на этом устройстве.
        Имя и уровень — в аккаунте.
      </p>

      {/* Написать владельцу. До этого из приложения написать было НЕКУДА:
          адрес лежал только в юридических страницах, куда никто не заходит. */}
      <div className="rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
        <p className="text-[15px] font-medium">Что-то не работает или непонятно?</p>
        <p className="mt-1 text-sm text-fg-secondary">
          Напиши мне — починю или объясню. {SUPPORT_SLA}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Отзыв — отдельно от письма: письмо человек пишет, когда что-то
              сломалось, а «чего не хватает» так никто не расскажет. Порог
              должен быть в один тап. */}
          <button
            onClick={() => setFeedback(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-4 text-sm font-medium text-accent-soft-fg shadow-card"
          >
            <IconThumbsUp size={16} /> Оставить отзыв
          </button>
          <a
            href={supportMailto()}
            className="inline-flex min-h-11 items-center rounded-xl border border-tint/[0.10] px-4 text-sm font-medium text-fg-secondary shadow-card"
          >
            Написать на {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      {feedback && <FeedbackSheet where="settings" onClose={() => setFeedback(false)} />}

      {/* Link, не <a>: обычная ссылка перезагружает всё приложение и рвёт
          историю — «Назад» с тех страниц переставал возвращать сюда */}
      <p className="px-1 text-xs text-fg-muted">
        <AppLink to="/terms" className="underline hover:text-fg-secondary">
          Условия использования
        </AppLink>{' '}
        ·{' '}
        <AppLink to="/privacy" className="underline hover:text-fg-secondary">
          Политика конфиденциальности
        </AppLink>{' '}
        ·{' '}
        <AppLink to="/pricing" className="underline hover:text-fg-secondary">
          Тарифы
        </AppLink>
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
      className="animate-fade-up rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card"
      style={{ animationDelay: delay }}
    >
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  )
}
