// ============================================================================
// Язык изучения (EN / ES) — глобальный переключатель.
// Выбор хранится в localStorage и переживает перезагрузку страницы.
// ============================================================================
import { createContext, useContext, useState, type ReactNode } from 'react'
import { readRaw, writeRaw } from '../lib/storage'
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
  return readRaw(STORAGE_KEY) === 'es' ? 'es' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(readStoredLang)

  const setLang = (next: AppLang) => {
    setLangState(next)
    writeRaw(STORAGE_KEY, next)
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
