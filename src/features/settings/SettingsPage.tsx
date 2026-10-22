// ============================================================================
// «Настройки» (роут /settings, вход из меню под аватаром; макеты d14 —
// компьютер, u4 — телефон). Разделы карточками: «Профиль» (имя и уровень —
// в аккаунте, «Сохранить»), «Оформление» (цвет и режим этого устройства,
// shared/ui/theme), у репетитора «Уроки» (ссылка на урок по умолчанию), у
// ученика с преподавателем «Уведомления», «Озвучка» (скорость и
// «Проверить»), «Текст в чтении» (размер и пример строки), «Безопасность» и
// «Что-то не работает или непонятно?». Скорость и размер хранятся на
// устройстве (lib/settings.ts) и сохраняются сразу.
// На компьютере (содержимое от 936) — разделы до 640 и оглавление 220 справа,
// оно держится при прокрутке и подсвечивает раздел на экране (MainAside nav).
// Раздела «Данные» (выгрузка, удаление аккаунта) пока нет — PLAN.md 4г-2б.
// ============================================================================
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import { loadProfile } from '../../lib/profile'
import { speak } from '../../lib/speech'
import { READER_CLASSES, SPEECH_RATES, getSettings, setSettings, type ReaderSize, type SpeechRate } from '../../lib/settings'
import { BackButton } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup, type ChoiceOption } from '../../shared/ui/ChoiceGroup'
import { IconPlay } from '../../shared/ui/icons'
import { MainAside, useAsideSplit } from '../../shared/ui/layouts'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { Field } from '../../shared/ui/TextField'
import { ThemePicker } from '../../shared/ui/ThemePicker'
import type { CEFRLevel, Profile } from '../../types'
import { HelpSection } from './HelpSection'
import { LessonLinkSection } from './LessonLinkSection'
import { LessonReminders } from './LessonReminders'
import { ProfileSection } from './ProfileSection'
import { SecuritySection } from './SecuritySection'
import { SettingsCard, SettingsToc } from './settingsBits'

const SPEECH_LABELS: ChoiceOption<SpeechRate>[] = [
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
/** Пример строки для «Текста в чтении» — на языке учёбы. */
const SAMPLE = { en: 'She stayed calm and resilient.', es: 'Se quedó tranquila y segura.' } as const

export function SettingsPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const desk = useAsideSplit()
  const [profile, setProfile] = useState<Profile | null>(null)
  // профиль ещё не пришёл / не пришёл совсем (нет связи): формы нет — пустые
  // имя и уровень, сохранённые после возврата связи, затёрли бы настоящие (Ф1.13)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [local, setLocal] = useState(getSettings)

  useEffect(() => {
    if (!user) return
    // null — ряда нет: это не сбой связи, форма остаётся; сбой — бросает
    loadProfile(user.id).then(
      (p) => {
        setProfile(p)
        setState('ready')
      },
      () => setState('failed'),
    )
  }, [user, attempt])

  const patchLocal = (p: Partial<typeof local>) => setLocal(setSettings(p))
  const level = lang === 'es' ? (getEsLevel() as CEFRLevel | null) : ((profile?.level as CEFRLevel) ?? null)

  const parts = (
    <div id="settings-parts" className="flex flex-col gap-4">
      {state === 'failed' ? (
        <LoadError message="Профиль не загрузился — похоже, пропала связь." onRetry={() => setAttempt((n) => n + 1)} />
      ) : state === 'loading' ? (
        <RowsSkeleton count={2} height={52} />
      ) : (
        // key — язык: уровень в поле — уровень языка из шапки
        <ProfileSection key={lang} profile={profile} initialLevel={level} />
      )}

      {/* «Цвет» и «Режим» этого устройства (макеты u4, d14; Ф2.17-2) */}
      <SettingsCard id="theme" title="Оформление">
        <ThemePicker />
      </SettingsCard>

      {/* ссылка на урок по умолчанию — у репетитора (u4-2, d14-1) */}
      {profile?.role === 'teacher' && <LessonLinkSection />}

      {/* напоминания об уроках — ученику с преподавателем (Ф2.9, u4-1, d14-2): раздел решает сам */}
      <LessonReminders />

      <SettingsCard id="voice" title="Озвучка">
        <Field label="Скорость">
          <div className="flex flex-wrap items-center gap-3">
            <ChoiceGroup
              variant="segment"
              pill
              stretch
              label="Скорость озвучки"
              options={SPEECH_LABELS}
              value={local.speechRate}
              onChange={(id) => patchLocal({ speechRate: id })}
              className="min-w-70 max-w-90 flex-1"
            />
            <Button variant="outline" onClick={() => speak(lang === 'es' ? 'Hola, ¿cómo estás?' : 'This is how it sounds.', { lang, rate: SPEECH_RATES[local.speechRate] })}>
              <IconPlay size={18} aria-hidden /> Проверить
            </Button>
          </div>
        </Field>
      </SettingsCard>

      <SettingsCard id="reader" title="Текст в чтении">
        <ChoiceGroup
          variant="segment"
          pill
          stretch
          label="Размер текста в чтении"
          options={SIZE_LABELS}
          value={local.readerSize}
          onChange={(id) => patchLocal({ readerSize: id })}
          className="max-w-105"
        />
        <p lang={lang} className={`rounded-control-sm bg-input px-3 py-2.5 text-fg ${READER_CLASSES[local.readerSize]}`} data-reader-sample>
          {SAMPLE[lang]}
        </p>
      </SettingsCard>

      {/* форма со своим состоянием и проверкой текущего пароля — отдельным файлом */}
      <SecuritySection />

      <HelpSection />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {desk ? (
        <h1 className="min-h-10 text-2xl font-semibold tracking-tight">Настройки</h1>
      ) : (
        <header className="flex items-center gap-2">
          <BackButton fallback="/" />
          <h1 className="text-2xl font-medium tracking-tight">Настройки</h1>
        </header>
      )}
      {desk ? <MainAside size="nav" label="Разделы настроек" main={parts} aside={<SettingsToc rootId="settings-parts" />} /> : parts}
    </div>
  )
}
