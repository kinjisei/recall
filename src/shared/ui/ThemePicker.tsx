// ============================================================================
// Выбор темы: «Как в системе / Светлая / Тёмная» (журнал п.37).
//
// Сейчас стоит только в админке — владелец смотрит черновую светлую тему на
// своём устройстве. Когда тема станет для всех (THEME_FOR_EVERYONE, PLAN.md
// Ф2.17), этот же компонент переезжает в Настройки — второй переключатель не
// пишется.
// ============================================================================
import { useState } from 'react'
import { TabPicker } from './TabPicker'
import { setThemeChoice, themeChoice, type ThemeChoice } from './theme'

const OPTIONS: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
]

export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>(themeChoice)
  return (
    <TabPicker
      ariaLabel="Тема оформления"
      options={OPTIONS}
      value={choice}
      onChange={(c) => {
        setThemeChoice(c)
        setChoice(c)
      }}
    />
  )
}
