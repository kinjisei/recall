import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-solid' | 'danger-outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: Variant
  /** Высота по листу s3: sm 44 · md 48 · lg 56 (главная на экране). */
  size?: Size
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

// Кнопки листа s3 («Основа стиля · компоненты»):
//   primary   — главная, одна на экран: primary, нажатая — primary-press;
//   secondary — вторичная: мягкая подложка accent-soft («Перенести», «Начать
//               занятие» перед уроком, макет u1-2), нажатая — accent-soft-press;
//   outline   — вторичная рядом с заголовком карточки на компьютере: фон
//               поверхности и тонкая рамка line («+ Выдать слова», макет
//               d10-3), нажатая — дымка строки;
//   ghost     — тихая: только текст accent-strong, нажатая — дымка;
//   danger    — опасная: только там, где действие что-то отменяет — мягкая
//               danger-soft с текстом danger-strong;
//   danger-solid — сплошной красный: подтверждение необратимого в диалоге
//               (ConfirmDialog, макет t5-2).
// Нажатие — на касание (pointerdown, :active): тон -press и scale .97 сразу
// (80 мс), возврат 160 мс; при «уменьшить движение» — только тон. Выключенная
// — подложка input и текст fg-faint: читается, но явно неактивна (контраст
// выключенному элементу WCAG не задаёт); рядом экран объясняет, почему.
// ⚠️ Своих копий главной кнопки (`bg-fg text-page` в className) не заводить:
// они не знают про светлую тему и остаются чёрными. Высоту, радиус и размер
// текста не перебивать классами (py-2 text-sm): два класса одного свойства
// решает порядок в CSS, а не в строке, — для этого есть size.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary font-semibold text-primary-fg shadow-card active:bg-primary-press',
  secondary: 'bg-accent-soft font-medium text-accent-soft-fg active:bg-accent-soft-press',
  outline: 'bg-surface font-medium text-fg inset-ring inset-ring-line active:bg-row-press',
  ghost: 'bg-transparent font-medium text-accent-strong active:bg-ghost-press',
  danger: 'bg-danger-soft font-medium text-danger-strong active:bg-danger-soft-press',
  'danger-solid': 'bg-danger font-semibold text-danger-fg shadow-card active:brightness-90',
  // необратимое, но не главное на экране: «Удалить задание» под чертой (d9-1)
  'danger-outline': 'bg-transparent font-semibold text-danger-strong inset-ring inset-ring-danger active:bg-danger-soft-press',
}

/** Нажатое состояние без пальца — витрина /dev/ui показывает его рядом с обычным. */
const PRESSED: Record<Variant, string> = {
  primary: 'data-press:bg-primary-press',
  secondary: 'data-press:bg-accent-soft-press',
  outline: 'data-press:bg-row-press',
  ghost: 'data-press:bg-ghost-press',
  danger: 'data-press:bg-danger-soft-press',
  'danger-solid': 'data-press:brightness-90',
  'danger-outline': 'data-press:bg-danger-soft-press',
}

// радиус ≈ 30 % высоты (s2): 14 · 16 · 18
const SIZES: Record<Size, string> = {
  sm: 'min-h-11 rounded-control-sm px-4 text-sm',
  md: 'min-h-12 rounded-control px-4 text-base',
  lg: 'min-h-14 rounded-control-lg px-5 text-lg',
}

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 transition-[scale,background-color,color,filter] duration-(--dur-1) ease-out ' +
  'active:scale-97 active:duration-(--dur-press) data-press:scale-97 motion-reduce:active:scale-100 motion-reduce:data-press:scale-100'

/** Выключенная: у тихой подложки нет и в выключенном виде (s3). */
const OFF = 'cursor-not-allowed font-medium text-fg-faint'
const OFF_BG: Record<Variant, string> = {
  primary: 'bg-input',
  secondary: 'bg-input',
  outline: 'bg-surface inset-ring inset-ring-line',
  ghost: 'bg-transparent',
  danger: 'bg-input',
  'danger-solid': 'bg-input',
  'danger-outline': 'bg-transparent inset-ring inset-ring-line',
}

/** Индикатор загрузки листа s3: кольцо и дуга, 0,9 с на оборот. */
export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className="animate-spin [animation-duration:0.9s]"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" strokeOpacity="0.3" />
      <path d="M20.5 12A8.5 8.5 0 0 0 12 3.5" />
    </svg>
  )
}

/** Классы кнопки — и для ссылки, которая выглядит кнопкой (`AppLink`). */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', off = false): string {
  const look = off ? `${OFF} ${OFF_BG[variant]}` : `${VARIANTS[variant]} ${PRESSED[variant]}`
  return `${BASE} ${look} ${SIZES[size]}`
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  // Загрузка держит ширину: подпись остаётся в раскладке невидимой, индикатор
  // встаёт поверх по центру — кнопка не прыгает и не нажимается повторно.
  // Выключенный вид — только у disabled: кнопка в загрузке остаётся своего цвета.
  return (
    <button
      className={`${buttonClass(variant, size, !!disabled && !loading)} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
