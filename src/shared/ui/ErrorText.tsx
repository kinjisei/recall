// ============================================================================
// Ошибка действия — одна строка под формой или кнопкой (лист s3): цвет
// danger-strong, для чтения с экрана — тревога (role="alert"). Энергия в
// тексте — значком: отказ сервера «на бесплатном тарифе это 5 ⚡ в день»
// приходит строкой с символом, а символ у каждой системы свой (BoltText).
//
// До 4д-1 каждый экран писал свой абзац: 65 мест, три разных красных
// (обычный `text-danger` мелким текстом в светлой теме — 4,4 : 1, ниже
// нормы), `role="alert"` — через раз, «⚡» — символом. Свой абзац ошибки в
// src/ не пропускает test-error-text.mjs.
// ============================================================================
import type { ReactNode } from 'react'
import { BoltText } from './Bolt'

export function ErrorText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={`text-sm text-danger-strong ${className}`}>
      {typeof children === 'string' ? <BoltText>{children}</BoltText> : children}
    </p>
  )
}
