import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: Variant
  loading?: boolean
}

const styles: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-sm shadow-sky-600/20 hover:brightness-105 active:brightness-95',
  secondary:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 active:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600',
  ghost:
    'bg-transparent text-sky-700 hover:bg-sky-50 active:bg-sky-100 dark:text-sky-400 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
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
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-base font-semibold transition-[transform,filter,background-color] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${styles[variant]} ${className}`}
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
