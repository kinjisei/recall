import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: Variant
  loading?: boolean
}

// Главная кнопка — токены primary: в тёмной теме светлая заливка с тёмным
// текстом (как было), в светлой — фиолетовая с белым; тень видна только в
// светлой. Вторичная — акцентная outline, ghost — только текст акцентом.
// ⚠️ Своих копий главной кнопки (`bg-fg text-page` в className) не заводить:
// они не знают про светлую тему и остаются чёрными.
const styles: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-fg shadow-card hover:brightness-95 active:brightness-90',
  secondary:
    'border border-accent-line bg-accent/14 text-fg hover:bg-accent/22',
  ghost:
    'bg-transparent text-accent-strong hover:bg-tint/[0.06]',
  danger: 'bg-danger/90 text-danger-fg hover:bg-danger',
  // спокойное опасное действие («Выйти из аккаунта»): красный текст на мягкой
  // подложке с рамкой — заметно в обеих темах, но не кричит, как сплошной danger
  'danger-outline':
    'border border-danger/30 bg-danger/10 text-danger-strong hover:bg-danger/15',
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  )
}

/** Волна от точки нажатия; узел удаляет себя по окончании анимации. */
function spawnRipple(e: PointerEvent<HTMLButtonElement>) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const d = Math.max(rect.width, rect.height) * 2
  const span = document.createElement('span')
  span.className = 'ripple'
  span.style.width = span.style.height = `${d}px`
  span.style.left = `${e.clientX - rect.left - d / 2}px`
  span.style.top = `${e.clientY - rect.top - d / 2}px`
  btn.appendChild(span)
  span.addEventListener('animationend', () => span.remove())
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  onPointerDown,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-base font-semibold transition-[transform,filter,background-color] duration-150 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      onPointerDown={(e) => {
        spawnRipple(e)
        onPointerDown?.(e)
      }}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
