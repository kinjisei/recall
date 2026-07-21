// ============================================================================
// Фирменный icon-набор Recall (50 шт.), сгенерирован из handoff/icons/*.svg
// (Claude Design). Единый стиль: viewBox 0 0 24 24, stroke 1.75px (2px у *-fill),
// currentColor. Меняем весь набор здесь — приложение подхватит.
//   НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ: перегенерировать из SVG.
// ============================================================================
import type { CSSProperties } from 'react'

export interface IconProps {
  size?: number
  className?: string
  style?: CSSProperties
  'aria-hidden'?: boolean
}

/** Фабрика: внутренний SVG-markup + толщина линии -> компонент иконки. */
function icon(inner: string, strokeWidth = '1.75') {
  return function Icon({ size = 24, className, style, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        {...rest}
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    )
  }
}

export const IconArrowRight = icon(
  '<path d="M4 12h15.5"></path><path d="M13.5 5.5 20 12l-6.5 6.5"></path>',
)
export const IconArrowUp = icon(
  '<path d="M12 20V4.5"></path><path d="M5.5 11 12 4.5 18.5 11"></path>',
)
export const IconBack = icon(
  '<path d="M14.5 5.5 8 12l6.5 6.5"></path>',
)
export const IconBadgeCheck = icon(
  '<path d="M12 3.5l1.9 1.4 2.3-.3 1 2.2 2.2 1-.3 2.3 1.4 1.9-1.4 1.9.3 2.3-2.2 1-1 2.2-2.3-.3-1.9 1.4-1.9-1.4-2.3.3-1-2.2-2.2-1 .3-2.3L3.5 12l1.4-1.9-.3-2.3 2.2-1 1-2.2 2.3.3Z"></path><path d="M9.2 12.2l2 2 3.6-4"></path>',
)
export const IconChart = icon(
  '<path d="M4 4.5v14A1.5 1.5 0 0 0 5.5 20H20"></path><path d="M7.5 15.5 11.5 11l2.8 2.8 5.2-5.3"></path><path d="M15.5 8.5h4v4"></path>',
)
export const IconCheck = icon(
  '<path d="M5 12.8 9.8 17.5 19 7"></path>',
)
export const IconDialogFill = icon(
  '<path d="M7.5 4.5h9A3.5 3.5 0 0 1 20 8v4.5a3.5 3.5 0 0 1-3.5 3.5h-6.3l-3.9 3.2a.8.8 0 0 1-1.3-.6V8a3.5 3.5 0 0 1 3.5-3.5Z" fill="currentColor" fill-opacity=".32"></path>', '2',
)
export const IconDialog = icon(
  '<path d="M7.5 4.5h9A3.5 3.5 0 0 1 20 8v4.5a3.5 3.5 0 0 1-3.5 3.5h-6.3l-3.9 3.2a.8.8 0 0 1-1.3-.6V8a3.5 3.5 0 0 1 3.5-3.5Z"></path>',
)
export const IconFlame = icon(
  '<path d="M12 3.5c1.2 2.4 3.6 4 4.9 6.4a6.3 6.3 0 1 1-11-.2C7.2 7.5 10.6 6 12 3.5Z"></path><path d="M9.8 16.7a2.2 2.2 0 0 0 4.4 0c0-1.3-1-2.1-2.2-3.2-1.2 1.1-2.2 1.9-2.2 3.2Z"></path>',
)
export const IconGap = icon(
  '<path d="M12 6.7C10.6 5.2 8.6 4.5 4 4.5v13.2c4.6 0 6.6.7 8 2.1 1.4-1.4 3.4-2.1 8-2.1V4.5c-4.6 0-6.6.7-8 2.2Z"></path><path d="M12 6.7v13.1"></path>',
)
export const IconGear = icon(
  '<circle cx="12" cy="12" r="3.25"></circle><path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M18 6l-1.7 1.7M7.7 16.3 6 18M18 18l-1.7-1.7M7.7 7.7 6 6"></path>',
)
export const IconGraduation = icon(
  '<path d="M3 9.5 12 5l9 4.5-9 4.5Z"></path><path d="M6.5 11.6v4.2c0 1.5 2.5 2.9 5.5 2.9s5.5-1.4 5.5-2.9v-4.2"></path><path d="M21 9.5v4.5"></path>',
)
export const IconHeadphones = icon(
  '<path d="M4.5 17.5v-4a7.5 7.5 0 0 1 15 0v4"></path><rect x="3.5" y="14" width="4.2" height="6" rx="1.9"></rect><rect x="16.3" y="14" width="4.2" height="6" rx="1.9"></rect>',
)
export const IconHint = icon(
  '<path d="M12 3.5a6 6 0 0 0-3.6 10.8c.9.7 1.6 1.7 1.6 2.7h4c0-1 .7-2 1.6-2.7A6 6 0 0 0 12 3.5Z"></path><path d="M10 20.5h4"></path>',
)
export const IconHomeFill = icon(
  '<path d="M4 10.8 12 4.5l8 6.3"></path><path d="M6 9.5 12 4.8l6 4.7V18a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18Z" fill="currentColor" fill-opacity=".32"></path><path d="M10 19.5v-4.5h4v4.5"></path>', '2',
)
export const IconHome = icon(
  '<path d="M4 10.8 12 4.5l8 6.3"></path><path d="M6 9.5V18a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 18V9.5"></path><path d="M10 19.5v-4.5h4v4.5"></path>',
)
export const IconKeyboard = icon(
  '<rect x="3" y="7" width="18" height="11" rx="2"></rect><path d="M6.5 10.4h.2M9.8 10.4h.2M13.1 10.4h.2M16.4 10.4h.2M6.5 13h.2M16.9 13h.2"></path><path d="M8.5 15.3h7"></path>',
)
export const IconMaterials = icon(
  '<path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5Z"></path><path d="M13.5 3.5v5h5"></path><path d="M9 13h4.5"></path><path d="M9 16h3"></path>',
)
export const IconMcq = icon(
  '<rect x="4" y="4" width="16" height="16" rx="3"></rect><path d="M8.3 12.4l2.6 2.6 4.8-5.4"></path>',
)
export const IconMeaning = icon(
  '<path d="M9.8 14.2l4.4-4.4"></path><path d="M9.3 7.6l1.6-1.6a3.4 3.4 0 0 1 4.8 4.8l-1.6 1.6"></path><path d="M14.7 16.4l-1.6 1.6a3.4 3.4 0 0 1-4.8-4.8l1.6-1.6"></path>',
)
export const IconMicFill = icon(
  '<rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="currentColor" fill-opacity=".32"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path><path d="M12 18v2.5"></path>', '2',
)
export const IconMic = icon(
  '<rect x="9" y="3.5" width="6" height="10.5" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path><path d="M12 18v2.5"></path>',
)
export const IconPencil = icon(
  '<path d="M4.5 19.5l3.9-.9L18.7 8.3a2.05 2.05 0 0 0-2.9-2.9L5.4 15.6l-.9 3.9Z"></path><path d="M13.9 7.3l2.9 2.9"></path>',
)
export const IconPlus = icon(
  '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
)
export const IconPracticeFill = icon(
  '<rect x="6" y="7" width="3" height="10" rx="1.5" fill="currentColor" fill-opacity=".32"></rect><rect x="15" y="7" width="3" height="10" rx="1.5" fill="currentColor" fill-opacity=".32"></rect><path d="M9 12h6"></path><path d="M3 12h3M18 12h3"></path>', '2',
)
export const IconPractice = icon(
  '<rect x="6" y="7" width="3" height="10" rx="1.5"></rect><rect x="15" y="7" width="3" height="10" rx="1.5"></rect><path d="M9 12h6"></path><path d="M3 12h3M18 12h3"></path>',
)
export const IconPrinter = icon(
  '<path d="M7 8V4.5h10V8"></path><path d="M7 16H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 16h-2"></path><path d="M7 13h10v6.5H7Z"></path><path d="M17 10.7h.2"></path>',
)
export const IconPuzzle = icon(
  '<path d="M9.7 5.4a2.1 2.1 0 1 1 4.2 0h2.3A1.6 1.6 0 0 1 17.8 7v2.3a2.1 2.1 0 1 1 0 4.2v2.3a1.6 1.6 0 0 1-1.6 1.6h-2.3a2.1 2.1 0 1 0-4.2 0H7.4a1.6 1.6 0 0 1-1.6-1.6v-2.3a2.1 2.1 0 1 0 0-4.2V7a1.6 1.6 0 0 1 1.6-1.6Z"></path>',
)
export const IconRefresh = icon(
  '<path d="M19.5 12a7.5 7.5 0 1 1-7.5-7.5c2.1 0 4.1.9 5.6 2.4l1.9 1.8"></path><path d="M19.5 4.2v4.5H15"></path>',
)
export const IconRows = icon(
  '<path d="M4 6.5h16"></path><path d="M4 12h16"></path><path d="M4 17.5h10"></path>',
)
export const IconSearch = icon(
  '<circle cx="11" cy="11" r="6.5"></circle><path d="M15.7 15.7 20.5 20.5"></path>',
)
export const IconSend = icon(
  '<path d="M20.5 3.5 3.5 9.8l6.2 2.5 2.5 6.2Z"></path><path d="M20.5 3.5 9.7 12.3"></path>',
)
export const IconShuffle = icon(
  '<path d="M3.5 7H7l10 10h2.5"></path><path d="M17 14.5 19.5 17 17 19.5"></path><path d="M3.5 17H7l3.2-3.2"></path><path d="M13.8 10.2 17 7h2.5"></path><path d="M17 4.5 19.5 7 17 9.5"></path>',
)
export const IconSignOut = icon(
  '<path d="M13.5 4.5H7.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6"></path><path d="M10.5 12h10"></path><path d="M17 8.5 20.5 12 17 15.5"></path>',
)
export const IconSparkle = icon(
  '<path d="M11 4.5l1.6 4.2 4.2 1.6-4.2 1.6L11 16.1l-1.6-4.2-4.2-1.6 4.2-1.6Z"></path><path d="M17.8 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9Z"></path>',
)
export const IconSpeakerSlow = icon(
  '<path d="M4 9.5h2.8L11.5 6v12l-4.7-3.5H4Z"></path><path d="M14.5 9.3a4 4 0 0 1 0 5.4" stroke-dasharray="2 2.6"></path><path d="M17.2 6.8a7.5 7.5 0 0 1 0 10.4" stroke-dasharray="2 2.6"></path>',
)
export const IconSpeaker = icon(
  '<path d="M4 9.5h2.8L11.5 6v12l-4.7-3.5H4Z"></path><path d="M14.5 9.3a4 4 0 0 1 0 5.4"></path><path d="M17.2 6.8a7.5 7.5 0 0 1 0 10.4"></path>',
)
export const IconSpeechFill = icon(
  '<rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="currentColor" fill-opacity=".32"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path><path d="M12 18v2.5"></path>', '2',
)
export const IconSpeech = icon(
  '<rect x="9" y="3.5" width="6" height="10.5" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"></path><path d="M12 18v2.5"></path>',
)
export const IconSpinner = icon(
  '<path d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5"></path>',
)
export const IconStop = icon(
  '<rect x="6.5" y="6.5" width="11" height="11" rx="2"></rect>',
)
export const IconStudents = icon(
  '<circle cx="9" cy="8.5" r="3"></circle><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"></path><path d="M15.3 5.9a3 3 0 0 1 .1 5.3"></path><path d="M17 14.6a5.5 5.5 0 0 1 3.5 4.9"></path>',
)
export const IconStudyFill = icon(
  '<rect x="4" y="4" width="14" height="4.6" rx="1.5" fill="currentColor" fill-opacity=".32"></rect><rect x="6" y="9.7" width="14" height="4.6" rx="1.5" fill="currentColor" fill-opacity=".32"></rect><rect x="4.5" y="15.4" width="13" height="4.6" rx="1.5" fill="currentColor" fill-opacity=".32"></rect>', '2',
)
export const IconStudy = icon(
  '<rect x="4" y="4" width="14" height="4.6" rx="1.5"></rect><rect x="6" y="9.7" width="14" height="4.6" rx="1.5"></rect><rect x="4.5" y="15.4" width="13" height="4.6" rx="1.5"></rect>',
)
export const IconTeacher = icon(
  '<rect x="4" y="4.5" width="16" height="10.5" rx="1.5"></rect><path d="M8 8.2h5.5"></path><path d="M8 11.2h8"></path><path d="M12 15v2"></path><path d="M8 20.5l4-3.5 4 3.5"></path>',
)
export const IconThumbsUp = icon(
  '<path d="M7.5 10.8 11.2 4.5c1.2 0 2 .9 2 2.1v3.2h4.5a1.8 1.8 0 0 1 1.8 2.1l-.9 5.1a2.4 2.4 0 0 1-2.4 2H7.5Z"></path><path d="M4.5 10.8h3V19h-3Z"></path>',
)
export const IconTimer = icon(
  '<circle cx="12" cy="13.5" r="7"></circle><path d="M10 3h4"></path><path d="M12 3v3.5"></path><path d="M12 13.5l2.8-2.5"></path>',
)
export const IconTranslate = icon(
  '<path d="M3.5 16.5 7 7.5l3.5 9"></path><path d="M4.6 13.7h4.8"></path><circle cx="16.4" cy="14" r="2.4"></circle><path d="M18.8 11.6v4.9"></path>',
)
export const IconTrophy = icon(
  '<path d="M8 4.5h8v5.5a4 4 0 0 1-8 0Z"></path><path d="M8 6.5H5a3 3 0 0 0 3.2 3M16 6.5h3a3 3 0 0 1-3.2 3"></path><path d="M12 14v3"></path><path d="M8.5 20.5h7"></path><path d="M10.5 17.5h3"></path>',
)
export const IconWarning = icon(
  '<path d="M10.7 5.2 3.6 17.6a1.5 1.5 0 0 0 1.3 2.2h14.2a1.5 1.5 0 0 0 1.3-2.2L13.3 5.2a1.5 1.5 0 0 0-2.6 0Z"></path><path d="M12 9.5V14"></path><path d="M12 16.9v.2"></path>',
)
