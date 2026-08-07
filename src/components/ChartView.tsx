// ============================================================================
// ChartView — рисуем график IELTS Academic Task 1 из ДАННЫХ (не из картинки).
// Типы: bar / line / pie / table. Инлайн SVG, тёмная тема, без зависимостей.
// Используется у ученика (описывает график) и в предпросмотре у учителя.
// ============================================================================
import type { ChartSpec } from '../types'

const COLORS = ['#9184d9', '#6ee7b7', '#fbbf24', '#f87171', '#60a5fa', '#f0abfc']
const AXIS = 'rgba(255,255,255,0.28)'
const GRID = 'rgba(255,255,255,0.08)'
const TEXT = 'rgba(255,255,255,0.72)'
const MUTED = 'rgba(255,255,255,0.5)'

function fmt(v: number, unit?: string): string {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
  return unit ? `${s}${unit === '%' ? '%' : ' ' + unit}` : s
}

export function ChartView({ chart }: { chart: ChartSpec }) {
  return (
    <figure className="w-full">
      <figcaption className="mb-2 text-center text-sm font-medium text-[var(--night-text-70)]">
        {chart.title}
      </figcaption>
      <div className="overflow-x-auto">
        {chart.kind === 'table' ? (
          <TableChart chart={chart} />
        ) : chart.kind === 'pie' ? (
          <PieChart chart={chart} />
        ) : (
          <AxisChart chart={chart} />
        )}
      </div>
      {chart.series.length > 1 && chart.kind !== 'table' && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {chart.series.map((s, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-[var(--night-text-70)]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </figure>
  )
}

// --- Столбчатая / линейная (общие оси) ---
function AxisChart({ chart }: { chart: ChartSpec }) {
  const W = 520
  const H = 300
  const padL = 46
  const padR = 14
  const padT = 12
  const padB = 46
  const labels = chart.series[0]?.points.map((p) => p.label) ?? []
  const all = chart.series.flatMap((s) => s.points.map((p) => p.value))
  const max = Math.max(1, ...all)
  // округляем верх шкалы вверх до «красивого» шага
  const step = niceStep(max)
  const top = Math.ceil(max / step) * step
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const x = (i: number) => padL + (plotW * (i + 0.5)) / Math.max(1, labels.length)
  const y = (v: number) => padT + plotH * (1 - v / top)
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]" role="img" aria-label={chart.title}>
      {/* сетка + подписи Y */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={GRID} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
            {fmt(t, chart.unit)}
          </text>
        </g>
      ))}
      {/* ось X подписи */}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize="11" fill={TEXT}>
          {l.length > 8 ? l.slice(0, 8) + '…' : l}
        </text>
      ))}
      {chart.xLabel && (
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill={MUTED}>
          {chart.xLabel}
        </text>
      )}

      {chart.kind === 'bar'
        ? chart.series.map((s, si) => {
            const bw = (plotW / Math.max(1, labels.length)) * 0.7
            const each = bw / chart.series.length
            return s.points.map((p, i) => (
              <rect
                key={`${si}-${i}`}
                x={x(i) - bw / 2 + si * each}
                y={y(p.value)}
                width={Math.max(2, each - 2)}
                height={padT + plotH - y(p.value)}
                rx={2}
                fill={COLORS[si % COLORS.length]}
              />
            ))
          })
        : chart.series.map((s, si) => {
            const d = s.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`)
              .join(' ')
            return (
              <g key={si}>
                <path d={d} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2.5} />
                {s.points.map((p, i) => (
                  <circle key={i} cx={x(i)} cy={y(p.value)} r={3} fill={COLORS[si % COLORS.length]} />
                ))}
              </g>
            )
          })}
      {/* ось */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={AXIS} />
      <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={AXIS} />
    </svg>
  )
}

function niceStep(max: number): number {
  const raw = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const n = raw / mag
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * mag
}

// --- Круговая ---
function PieChart({ chart }: { chart: ChartSpec }) {
  const pts = chart.series[0]?.points ?? []
  const total = pts.reduce((s, p) => s + p.value, 0) || 1
  const R = 90
  const cx = 120
  const cy = 110
  let angle = -Math.PI / 2
  return (
    <svg viewBox="0 0 380 230" className="h-auto w-full min-w-[360px]" role="img" aria-label={chart.title}>
      {pts.map((p, i) => {
        const frac = p.value / total
        const a2 = angle + frac * Math.PI * 2
        const large = frac > 0.5 ? 1 : 0
        const x1 = cx + R * Math.cos(angle)
        const y1 = cy + R * Math.sin(angle)
        const x2 = cx + R * Math.cos(a2)
        const y2 = cy + R * Math.sin(a2)
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
        angle = a2
        return <path key={i} d={d} fill={COLORS[i % COLORS.length]} stroke="#1e2030" strokeWidth={1.5} />
      })}
      {pts.map((p, i) => (
        <g key={i} transform={`translate(250 ${28 + i * 24})`}>
          <rect width={12} height={12} rx={2} fill={COLORS[i % COLORS.length]} />
          <text x={18} y={11} fontSize="12" fill={TEXT}>
            {p.label}: {Math.round((p.value / total) * 100)}%
          </text>
        </g>
      ))}
    </svg>
  )
}

// --- Таблица ---
function TableChart({ chart }: { chart: ChartSpec }) {
  const rows = chart.series[0]?.points.map((p) => p.label) ?? []
  return (
    <table className="w-full min-w-[360px] border-collapse text-sm">
      <thead>
        <tr>
          <th className="border border-white/[0.10] px-3 py-1.5 text-left text-[var(--night-text-40)]">
            {chart.xLabel || ''}
          </th>
          {chart.series.map((s, i) => (
            <th key={i} className="border border-white/[0.10] px-3 py-1.5 text-right font-medium">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            <td className="border border-white/[0.10] px-3 py-1.5 text-[var(--night-text-70)]">{r}</td>
            {chart.series.map((s, si) => (
              <td key={si} className="border border-white/[0.10] px-3 py-1.5 text-right">
                {fmt(s.points[ri]?.value ?? 0, chart.unit)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
