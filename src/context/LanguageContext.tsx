// ============================================================================
// Язык изучения (EN / ES) — глобальный переключатель.
// Выбор хранится в localStorage и переживает перезагрузку страницы.
// ============================================================================
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { AppLang } from '../types'

const STORAGE_KEY = 'recall.lang'

interface LanguageContextValue {
  lang: AppLang
  setLang: (lang: AppLang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
})

function readStoredLang(): AppLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(readStoredLang)

  const setLang = (next: AppLang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* приватный режим — не критично */
    }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
