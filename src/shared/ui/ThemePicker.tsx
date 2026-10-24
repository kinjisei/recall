// ============================================================================
// Выбор вида на этом устройстве — макет u4 (журнал п.56, PLAN.md Ф2.17-2):
//   «Цвет»  — «Сумерки» (по умолчанию) / «Закат»: плитка с кружком палитры;
//   «Режим» — «Как в системе» / «Светлая» / «Тёмная»: превью обеих тем
//             нынешней палитры (у «Как в системе» — наискосок пополам).
// Выбранное — мягкая подложка и рамка фокуса у цвета, кольцо фокуса у
// превью, кружок с галочкой. Отметка и превью меняются сразу
// (data-theme-instant), остальной экран перетекает за 200 мс (u4-3).
// Стоит в Настройках (features/settings) и на витрине /dev/ui.
// ============================================================================
import { useState } from 'react'
import { IconCheck } from './icons'
import {
  paletteChoice,
  setPalette,
  setThemeChoice,
  themeChoice,
  type Palette,
  type ThemeChoice,
} from './theme'

const PALETTES: { id: Palette; label: string; hint?: string; dot: string }[] = [
  {
    id: 'twilight',
    label: 'Сумерки',
    hint: 'по умолчанию',
    dot: 'from-swatch-twilight-from via-swatch-twilight-via to-swatch-twilight-to',
  },
  { id: 'sunset', label: 'Закат', dot: 'from-swatch-sunset-from via-swatch-sunset-via to-swatch-sunset-to' },
]

const MODES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' },
]

/** Кружок с галочкой у выбранного (u4: цвет главной кнопки, обводка фоном карточки). */
function Checked() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 flex size-5.5 items-center justify-center rounded-full bg-primary text-primary-fg ring-2 ring-surface"
    >
      <IconCheck size={14} />
    </span>
  )
}

/** Половина превью: фон, карточка, полоса главной кнопки, строка текста. */
function Half({ theme, diagonal = false }: { theme: 'light' | 'dark'; diagonal?: boolean }) {
  const light = theme === 'light'
  return (
    <span
      className={`absolute inset-0 flex flex-col gap-1.25 px-2 py-2.5 ${
        light ? 'bg-preview-light-page' : 'bg-preview-dark-page'
      } ${diagonal ? '[clip-path:polygon(100%_0,100%_100%,0_100%)]' : ''}`}
    >
      <span className={`h-2 w-[55%] rounded-full ${light ? 'bg-preview-light-accent' : 'bg-preview-dark-accent'}`} />
      <span className={`h-2 rounded-full ${light ? 'bg-preview-light-card ring-1 ring-scrim/[0.06]' : 'bg-preview-dark-card'}`} />
      <span className={`h-1 w-[70%] rounded-full opacity-50 ${light ? 'bg-preview-light-fg' : 'bg-preview-dark-fg'}`} />
    </span>
  )
}

export function ThemePicker() {
  const [palette, setPaletteState] = useState<Palette>(paletteChoice)
  const [mode, setMode] = useState<ThemeChoice>(themeChoice)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-2.5 pb-4">
        <span>Цвет</span>
        <div role="radiogroup" aria-label="Цвет" data-theme-instant className="grid grid-cols-2 gap-2.5">
          {PALETTES.map((p) => {
            const on = p.id === palette
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setPalette(p.id)
                  setPaletteState(p.id)
                }}
                className={`relative flex h-15 items-center gap-2.5 rounded-control px-3 text-left text-body ${
                  on ? 'bg-accent-soft font-semibold text-accent-soft-fg ring-2 ring-focus ring-inset' : 'bg-input font-medium text-fg'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-8 flex-none rounded-full bg-linear-135 via-45% ring-1 ring-scrim/[0.08] ring-inset ${p.dot}`}
                />
                <span className="flex min-w-0 flex-col">
                  {p.label}
                  {p.hint && <span className={`text-xs font-normal ${on ? 'text-accent-soft-fg' : 'text-fg-muted'}`}>{p.hint}</span>}
                </span>
                {on && <Checked />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-3.5">
        <span>Режим</span>
        <div role="radiogroup" aria-label="Режим" data-theme-instant className="grid grid-cols-3 gap-2.5">
          {MODES.map((m) => {
            const on = m.id === mode
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setThemeChoice(m.id)
                  setMode(m.id)
                }}
                className={`flex flex-col items-center gap-2 text-note whitespace-nowrap ${
                  on ? 'font-semibold text-accent-soft-fg' : 'font-medium text-fg'
                }`}
              >
                <span className="relative block w-full">
                  <span
                    className={`relative block h-18.5 w-full overflow-hidden rounded-control-sm ${
                      on ? 'ring-2 ring-focus ring-offset-2 ring-offset-surface' : 'ring-1 ring-line ring-inset'
                    }`}
                  >
                    {m.id !== 'dark' && <Half theme="light" />}
                    {m.id !== 'light' && <Half theme="dark" diagonal={m.id === 'system'} />}
                  </span>
                  {on && <Checked />}
                </span>
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
