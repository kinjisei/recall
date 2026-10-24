// ============================================================================
// Поиск — поле листа s3 (`fieldClass`) с лупой слева (4д-2). Один на все
// поиски по спискам: выбор слов, «Мои слова», глаголы, наборы слов, поиск
// пользователя в админке. До 4д-2 у каждого был свой вид: рамка tint и
// `text-sm`, карточка с тенью, лупа то внутри подписи, то поверх поля.
// Поиск «Учеников» (макет d3, высота 44) — свой, по макету.
// Свойства — как у обычного поля (value, onChange, onKeyDown…); имя для
// чтения с экрана — `label`, по умолчанию подсказка в поле.
// ============================================================================
import type { InputHTMLAttributes } from 'react'
import { IconSearch } from './icons'
import { fieldClass } from './TextField'

export function SearchField({
  label,
  className = '',
  placeholder,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & { label?: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <IconSearch size={18} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
      <input type="search" placeholder={placeholder} aria-label={label ?? placeholder} className={`${fieldClass()} pl-10`} {...input} />
    </label>
  )
}
