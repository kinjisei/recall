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
      className="flex gap-0.5 rounded-full border border-white/[0.08] bg-[var(--night-surface)] p-1"
      role="group"
      aria-label="Язык изучения"
    >
      {langTabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setLang(t.id)}
          aria-pressed={lang === t.id}
          className={`min-h-[44px] min-w-[48px] rounded-full px-4 text-xs font-medium transition-colors ${
            lang === t.id
              ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
              : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
