// Переключатель языка изучения EN / ES — в шапке телефона и внизу боковой
// панели компьютера. Язык хранится в LanguageContext (localStorage recall.lang).
import { useLanguage } from '../../context/LanguageContext'
import type { AppLang } from '../../types'

const langTabs: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]

export function LangSwitch() {
  const { lang, setLang } = useLanguage()
  return (
    <div
      className="flex gap-0.5 rounded-full border border-tint/[0.08] bg-surface p-1"
      role="group"
      aria-label="Язык изучения"
    >
      {langTabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setLang(t.id)}
          aria-pressed={lang === t.id}
          className={`min-h-11 min-w-12 rounded-full px-4 text-xs font-medium transition-colors ${
            lang === t.id
              ? 'bg-accent-soft text-accent-soft-fg'
              : 'text-fg-muted hover:text-fg-secondary'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
