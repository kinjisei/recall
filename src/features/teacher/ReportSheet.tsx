// ============================================================================
// Отчёт родителям (печать/PDF) — документ, который репетитор отправляет после
// месяца занятий. Он «продаёт» работу преподавателя, поэтому:
//   • сначала достижения (позитивный фрейминг), слабые места — как «фокус
//     следующего месяца», а не список провалов;
//   • конкретные числа вместо оценочных слов («выучено 14 слов», не «молодец»);
//   • комментарий преподавателя — живым текстом, поле заполняется до печати.
// Механика печати — как PrintSheet: портал в body, @media print прячет #root.
// Лист всегда белый (печать), независимо от тёмной темы приложения.
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import type { StudentDiagnostics } from '../../lib/diagnostics'
import type { MetricDelta } from '../../lib/dynamics'

const KIND_LABELS: Record<string, string> = {
  comprehension: 'понимание текста',
  grammar: 'грамматика',
  vocab: 'лексика',
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** «12 → 18» + словами, куда сдвинулись. moreIsBetter=false для ошибок. */
function DeltaRow({
  label,
  d,
  unit,
  moreIsBetter = true,
}: {
  label: string
  d: MetricDelta
  unit: string
  moreIsBetter?: boolean
}) {
  const now = d.now ?? 0
  const hasPrev = d.prev !== null && d.prev !== undefined
  const diff = hasPrev ? now - (d.prev as number) : null
  const improved = diff !== null && diff !== 0 && diff > 0 === moreIsBetter
  return (
    <div className="flex items-baseline justify-between border-b border-neutral-200 py-2">
      <span className="text-[15px]">{label}</span>
      <span className="text-right">
        <span className="text-xl font-bold">
          {d.now === null ? '—' : `${now}${unit}`}
        </span>
        {diff !== null && diff !== 0 && (
          <span
            className={`ml-2 text-sm font-medium ${improved ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
            {unit} за месяц
          </span>
        )}
        {diff === 0 && <span className="ml-2 text-sm text-neutral-400">без изменений</span>}
      </span>
    </div>
  )
}

export function ReportSheet({
  diag,
  studentName,
  topicTitle,
  onClose,
}: {
  diag: StudentDiagnostics
  studentName: string
  /** Название темы грамматики по (lang, topicId) — из данных уроков. */
  topicTitle: (lang: string, topicId: number) => string
  onClose: () => void
}) {
  const [comment, setComment] = useState('')
  const dyn = diag.dynamics
  const today = new Date()
  const from = new Date(today.getTime() - 30 * 86_400_000)

  // сильные стороны — только то, что реально подтверждено данными
  const strengths: string[] = []
  if (dyn.learnedRecently > 0) {
    const n = dyn.learnedRecently
    strengths.push(
      `${n} ${plural(n, 'слово', 'слова', 'слов')} за месяц ${n === 1 ? 'перешло' : 'перешли'} в «выученные» — интервальные повторения ${n === 1 ? 'закрепили его' : 'закрепили их'} надолго`,
    )
  }
  if ((dyn.activeDays.now ?? 0) > 0) {
    strengths.push(
      `${dyn.activeDays.now} ${plural(dyn.activeDays.now ?? 0, 'активный день', 'активных дня', 'активных дней')} из 30 — занятия идут регулярно`,
    )
  }
  const kinds = Object.entries(diag.kindTotals).filter(([, v]) => v.total >= 3)
  if (kinds.length > 0) {
    const best = kinds.reduce((a, b) => (a[1].ok / a[1].total >= b[1].ok / b[1].total ? a : b))
    const pct = Math.round((best[1].ok / best[1].total) * 100)
    if (pct >= 70) {
      strengths.push(`${KIND_LABELS[best[0]] ?? best[0]} — сильная сторона: ${pct}% верных ответов в заданиях`)
    }
  }
  if (diag.avgPercent !== null && diag.avgPercent >= 70) {
    strengths.push(`средний балл по заданиям — ${diag.avgPercent}%`)
  }

  // фокус — слабые места, поданные как план, а не как упрёк
  const focus: string[] = []
  for (const m of diag.mistakes.slice(0, 3)) {
    const t = topicTitle(m.lang, m.topicId)
    // названия уроков иногда сами содержат «кавычки» — не вкладываем «« »»
    const quoted = t.includes('«') ? t : `«${t}»`
    focus.push(`тема ${quoted} — повторим уроком и упражнениями`)
  }
  if (diag.words.struggling.length > 0) {
    focus.push(
      `слова, которые пока путаются: ${diag.words.struggling
        .slice(0, 4)
        .map((w) => w.front)
        .join(', ')} — вернём их в повторение`,
    )
  }
  if (kinds.length > 1) {
    const worst = kinds.reduce((a, b) => (a[1].ok / a[1].total <= b[1].ok / b[1].total ? a : b))
    const pct = Math.round((worst[1].ok / worst[1].total) * 100)
    if (pct < 70) focus.push(`${KIND_LABELS[worst[0]] ?? worst[0]} — добавим практики (сейчас ${pct}%)`)
  }

  return createPortal(
    <div className="print-sheet fixed inset-0 z-50 overflow-auto bg-white px-8 py-6 text-black">
      <div className="no-print mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <Button className="px-4 py-2 text-sm" onClick={() => window.print()}>
          🖨 Печать / Сохранить в PDF
        </Button>
        <Button variant="secondary" className="px-4 py-2 text-sm" onClick={onClose}>
          Закрыть
        </Button>
        <span className="text-xs text-slate-400">отчёт для родителей — проверь перед отправкой</span>
      </div>

      {/* поле комментария — только на экране; в печать уходит текст ниже */}
      <div className="no-print mx-auto mb-5 max-w-2xl">
        <label className="block text-sm font-medium text-slate-600">
          Комментарий преподавателя (попадёт в отчёт)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Пара живых фраз: что получалось на занятиях, что порадовало, на чём сосредоточимся…"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] text-black outline-none focus:border-slate-500"
          />
        </label>
      </div>

      <div className="mx-auto max-w-2xl font-serif leading-relaxed">
        {/* шапка: тонкая линейка-подпись сверху — единственный акцент листа */}
        <div className="border-t-4 border-black pt-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Отчёт о занятиях · {fmtDate(from)} — {fmtDate(today)}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{studentName}</h1>
        </div>

        <h2 className="mt-7 text-lg font-bold">Динамика за месяц</h2>
        <div className="mt-1">
          <DeltaRow label="Дней с занятиями" d={dyn.activeDays} unit="" />
          <DeltaRow label="Средний балл по заданиям" d={dyn.avgScore} unit="%" />
          <DeltaRow label="Новых слов добавлено" d={dyn.wordsAdded} unit="" />
          <DeltaRow label="Новых ошибок в грамматике" d={dyn.newMistakes} unit="" moreIsBetter={false} />
        </div>

        {strengths.length > 0 && (
          <>
            <h2 className="mt-6 text-lg font-bold">Что уже получается</h2>
            <ul className="mt-1 list-disc pl-5 text-[15px]">
              {strengths.map((s, i) => (
                <li key={i} className="py-0.5">{s}</li>
              ))}
            </ul>
          </>
        )}

        {focus.length > 0 && (
          <>
            <h2 className="mt-6 text-lg font-bold">Фокус следующего месяца</h2>
            <ul className="mt-1 list-disc pl-5 text-[15px]">
              {focus.map((s, i) => (
                <li key={i} className="py-0.5">{s}</li>
              ))}
            </ul>
          </>
        )}

        {comment.trim() && (
          <>
            <h2 className="mt-6 text-lg font-bold">От преподавателя</h2>
            <p className="mt-1 whitespace-pre-wrap border-l-2 border-neutral-300 pl-4 text-[15px] italic">
              {comment.trim()}
            </p>
          </>
        )}

        <p className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-400">
          Отчёт подготовлен в приложении Recall по данным занятий ·{' '}
          {today.toLocaleDateString('ru-RU')}
        </p>
      </div>
    </div>,
    document.body,
  )
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
