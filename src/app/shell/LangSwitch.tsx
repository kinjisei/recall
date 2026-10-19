// Переключатель языка изучения EN / ES — в шапке телефона и внизу меню
// компьютера; в рельсе 72 — столбиком (в строку 96 px не помещается). Вид —
// сегмент листа s3/s4: капсула input, выбранный — приподнятая плашка segment.
// Плашка — слоем с отступом 3 px внутри кнопки 44: вид как в макете, цель
// касания — вся кнопка (как у TabPicker). Язык хранится в LanguageContext
// (localStorage recall.lang).
import { useLanguage } from '../../context/LanguageContext'
import type { AppLang } from '../../types'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]

export function LangSwitch({ vertical = false }: { vertical?: boolean }) {
  const { lang, setLang } = useLanguage()
  return (
    <div className={`flex rounded-full bg-input ${vertical ? 'flex-col' : ''}`} role="group" aria-label="Язык изучения">
      {langTabs.map((t) => {
        const on = lang === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setLang(t.id)}
            aria-pressed={on}
            className={`relative min-h-11 rounded-full text-sm transition-colors duration-(--dur-1) ${vertical ? 'min-w-11' : 'min-w-13'} ${
              on ? 'font-semibold text-fg' : 'font-medium text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {on && <span aria-hidden className="absolute inset-0.75 rounded-full bg-segment shadow-segment" />}
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
