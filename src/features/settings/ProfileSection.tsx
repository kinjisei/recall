// ============================================================================
// «Профиль» в Настройках (макет d14): имя, «Мой уровень» полем-выбором
// («Испанский · A2» — уровень языка, который сейчас в шапке) и строка
// «Остальные настройки сохраняются сразу · Сохранить». Имя и уровень
// английского пишутся в профиль (RLS разрешает только эти колонки), уровень
// испанского живёт на устройстве (lib/esLevel).
// ============================================================================
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { setEsLevel } from '../../lib/esLevel'
import { updateMyProfile } from '../../lib/profile'
import { Button } from '../../shared/ui/Button'
import { IconCheck } from '../../shared/ui/icons'
import { Picker } from '../../shared/ui/Picker'
import { Field, TextField, fieldClass } from '../../shared/ui/TextField'
import type { CEFRLevel, Profile } from '../../types'
import { SettingsCard } from './settingsBits'
import { ErrorText } from '../../shared/ui/ErrorText'

// A1 включён: тест уровня может дать A1, и без него его нельзя было выбрать —
// сохранение затирало уровень на случайно нажатый
const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

export function ProfileSection({ profile, initialLevel }: { profile: Profile | null; initialLevel: CEFRLevel | null }) {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [level, setLevel] = useState<CEFRLevel | null>(initialLevel)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const langName = lang === 'es' ? 'Испанский' : 'Английский'

  const save = async () => {
    if (!user) return
    setError(null)
    setBusy(true)
    try {
      const patch: Parameters<typeof updateMyProfile>[1] = {}
      const trimmed = name.trim()
      if (trimmed && trimmed !== profile?.display_name) patch.display_name = trimmed
      // уровень испанского живёт локально, английского — в профиле
      if (level) {
        if (lang === 'es') setEsLevel(level)
        else if (level !== profile?.level) patch.level = level
      }
      await updateMyProfile(user.id, patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard id="profile" title="Профиль">
      <TextField label="Имя" value={name} onChange={(e) => setName(e.target.value)} placeholder="Как тебя зовут" autoComplete="name" />
      <Field label="Мой уровень">
        <Picker
          label="Мой уровень"
          value={level ?? ''}
          onChange={(id) => setLevel(id as CEFRLevel)}
          options={LEVELS.map((l) => ({ id: l, label: `${langName} · ${l}` }))}
          triggerClassName={`${fieldClass()} flex items-center justify-between gap-2.5 text-left`}
        />
      </Field>
      {error && (
        <ErrorText>
          {error}
        </ErrorText>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 text-sm text-fg-secondary">Остальные настройки сохраняются сразу</span>
        <Button loading={busy} onClick={() => void save()} data-profile-save>
          {saved ? (
            <>
              <IconCheck size={16} aria-hidden /> Сохранено
            </>
          ) : (
            'Сохранить'
          )}
        </Button>
      </div>
    </SettingsCard>
  )
}
