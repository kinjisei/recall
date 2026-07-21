import { readFileSync, writeFileSync, readdirSync } from 'fs'
const dir = 'handoff/icons'
const files = readdirSync(dir).filter(f => f.endsWith('.svg')).sort()
const pascal = (base) => 'Icon' + base.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('')
let body = ''
const names = []
for (const f of files) {
  const svg = readFileSync(`${dir}/${f}`, 'utf8').trim()
  const sw = (svg.match(/stroke-width="([^"]+)"/) || [,'1.75'])[1]
  const inner = (svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [,''])[1].trim()
  const name = pascal(f.replace('.svg',''))
  names.push(name)
  const swArg = sw === '1.75' ? '' : `, '${sw}'`
  body += `export const ${name} = icon(\n  '${inner.replace(/'/g, "\'")}'${swArg},\n)\n`
}
const header = `// ============================================================================
// Фирменный icon-набор Recall (${files.length} шт.), сгенерирован из handoff/icons/*.svg
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

`
writeFileSync('src/components/icons.tsx', header + body)
console.log(`icons.tsx: ${names.length} компонентов`)
console.log(names.join(', '))
