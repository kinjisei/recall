// ============================================================================
// Логотип Recall (из макета «Nocturne»): слово на флеш-карточке, где «ll» —
// две карточки, контурная и залитая.
//   BrandMark — компактный знак (шапка, пустые состояния);
//   BrandLogo — полный логотип со словом (экран входа, онбординг).
//
// Инлайн-SVG, а не <img>: так текст логотипа рисуется шрифтом страницы
// (Onest) — у внешней картинки доступа к нашим шрифтам нет.
// ============================================================================

/** Компактный знак: карточки-«ll» на карточке. */
export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Recall"
    >
      <rect
        x="12" y="14" width="26" height="22" rx="6"
        fill="none" stroke="#38366b" strokeWidth="2"
        transform="rotate(-6 25 25)"
      />
      <rect
        x="10" y="12" width="26" height="22" rx="6"
        fill="var(--night-surface)" stroke="var(--night-accent)" strokeWidth="2.2"
        transform="rotate(3 23 23)"
      />
      <g transform="rotate(3 23 23)">
        <rect
          x="16" y="18" width="4.6" height="11" rx="2"
          fill="none" stroke="var(--night-accent)" strokeWidth="1.7"
          transform="rotate(-6 18.3 23.5)"
        />
        <rect
          x="24" y="18" width="4.6" height="11" rx="2"
          fill="var(--night-accent)"
          transform="rotate(6 26.3 23.5)"
        />
      </g>
    </svg>
  )
}

/** Полный логотип: слово Recall на карточке. */
export function BrandLogo({ width = 200, className = '' }: { width?: number; className?: string }) {
  return (
    <svg
      width={width}
      height={width * (60 / 140)}
      viewBox="0 0 140 60"
      className={className}
      role="img"
      aria-label="Recall"
    >
      <rect
        x="14" y="12" width="112" height="38" rx="9"
        fill="none" stroke="#38366b" strokeWidth="1.8"
        transform="rotate(-3 70 31)"
      />
      <rect
        x="14" y="10" width="112" height="38" rx="9"
        fill="var(--night-surface)" stroke="var(--night-accent)" strokeWidth="2"
        transform="rotate(2 70 29)"
      />
      <g
        transform="rotate(2 70 29)"
        fontFamily="var(--night-font)"
        fontSize="19"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        <text x="41" y="36" fill="var(--night-accent-text)">Re</text>
        <text x="66" y="36" fill="var(--night-text)">c</text>
        <text x="77.5" y="36" fill="var(--night-accent)">a</text>
        <text x="89" y="36" fill="var(--night-text)">ll</text>
        <path d="M79 39.5 h9" stroke="var(--night-accent)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </svg>
  )
}
