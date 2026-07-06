// ============================================================================
// Набор инлайн-SVG-иконок (стиль Lucide, stroke=currentColor) — без внешних
// зависимостей. Используются в навигации и ключевых кнопках вместо эмодзи,
// чтобы интерфейс выглядел системно и одинаково на всех платформах.
// ============================================================================
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </Svg>
)

export const IconDeck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </Svg>
)

export const IconBook = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </Svg>
)

export const IconMic = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </Svg>
)

export const IconGrammar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M22 10 12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5" />
  </Svg>
)

export const IconGamepad = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 12h4" />
    <path d="M8 10v4" />
    <path d="M15 13h.01" />
    <path d="M18 11h.01" />
    <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59c-.09.9-.7 5.86-.7 7.41a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.61-6.51-.7-7.41A4 4 0 0 0 17.32 5z" />
  </Svg>
)

export const IconChat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
  </Svg>
)

export const IconFlame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Svg>
)

export const IconVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z" />
    <path d="M16 9a5 5 0 0 1 0 6" />
    <path d="M19.4 5.6a9 9 0 0 1 0 12.7" />
  </Svg>
)

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Svg>
)

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
)

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Svg>
)

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
)

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
)

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 18 6-6-6-6" />
  </Svg>
)

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 17H7A5 5 0 0 1 7 7h2" />
    <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
    <path d="M8 12h8" />
  </Svg>
)

export const IconType = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7V5h16v2" />
    <path d="M9 20h6" />
    <path d="M12 5v15" />
  </Svg>
)

export const IconBlocks = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3H4a1 1 0 0 0-1 1v6h7z" />
    <path d="M21 4a1 1 0 0 0-1-1h-6v7h7z" />
    <path d="M21 14h-7v7h6a1 1 0 0 0 1-1z" />
    <path d="M10 14H3v6a1 1 0 0 0 1 1h6z" />
  </Svg>
)

export const IconHeadphones = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
    <path d="M18 19a2 2 0 0 0 2-2v-3h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1z" />
    <path d="M6 19a2 2 0 0 1-2-2v-3h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1z" />
  </Svg>
)

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
    <path d="M19 3v4" />
    <path d="M21 5h-4" />
  </Svg>
)
