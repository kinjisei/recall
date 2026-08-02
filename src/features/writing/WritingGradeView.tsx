// ============================================================================
// Показ AI-оценки письма (Заход 5b) — общий для ученицы и преподавателя (5c).
// IELTS: band + 4 критерия; обычный: уровень + чек-листы целевых слов/грамматики.
// Плюс общий блок: ошибки (было→стало), сильные стороны, что подтянуть, rewrites.
// ============================================================================
import { IconCheck, IconClose } from '../../components/icons'
import type { WritingGrade, WritingMode } from '../../types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">{title}</p>
      {children}
    </div>
  )
}

export function WritingGradeView({ grade, mode }: { grade: WritingGrade; mode: WritingMode }) {
  return (
    <div className="flex flex-col gap-4">
      {mode === 'ielts' ? (
        <div className="rounded-2xl bg-[var(--night-accent-900)] px-4 py-3 text-center">
          <p className="text-3xl font-bold text-[var(--night-accent-100)]">
            {grade.band != null ? `Band ${grade.band}` : '—'}
          </p>
          {grade.criteria && (
            <div className="mt-2 grid grid-cols-4 gap-1 text-xs text-[var(--night-text-70)]">
              {(
                [
                  ['Task', grade.criteria.task],
                  ['Cohesion', grade.criteria.coherence],
                  ['Lexis', grade.criteria.lexis],
                  ['Grammar', grade.criteria.grammar],
                ] as [string, number][]
              ).map(([k, v]) => (
                <div key={k}>
                  <p className="font-semibold text-[var(--night-text)]">{v}</p>
                  <p>{k}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-lg font-bold">
            Уровень текста: <span className="text-[var(--night-accent-text)]">{grade.level || '—'}</span>
          </p>
          {grade.targetWords && grade.targetWords.length > 0 && (
            <Section title="Целевые слова">
              <div className="flex flex-wrap gap-1.5">
                {grade.targetWords.map((w, i) => (
                  <Chip key={i} label={w.w} ok={w.used} />
                ))}
              </div>
            </Section>
          )}
          {grade.targetGrammar && grade.targetGrammar.length > 0 && (
            <Section title="Целевая грамматика">
              <div className="flex flex-wrap gap-1.5">
                {grade.targetGrammar.map((g, i) => (
                  <Chip key={i} label={g.t} ok={g.used} />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {grade.errors && grade.errors.length > 0 && (
        <Section title="Ошибки">
          <div className="flex flex-col gap-1.5">
            {grade.errors.map((e, i) => (
              <div key={i} className="rounded-xl border border-red-500/25 px-3 py-2 text-sm">
                <p className="text-red-300 line-through decoration-red-500/60">{e.was}</p>
                <p className="text-emerald-300">→ {e.fix}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {grade.strengths && grade.strengths.length > 0 && (
        <Section title="Сильные стороны">
          <ul className="flex flex-col gap-1 text-sm text-[var(--night-text-70)]">
            {grade.strengths.map((s, i) => <li key={i}>+ {s}</li>)}
          </ul>
        </Section>
      )}

      {grade.improve && grade.improve.length > 0 && (
        <Section title="Что подтянуть">
          <ul className="flex flex-col gap-1 text-sm text-[var(--night-text-70)]">
            {grade.improve.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        </Section>
      )}

      {(grade.topics?.length || grade.words?.length) ? (
        <Section title="Повторить">
          <div className="flex flex-wrap gap-1.5">
            {[...(grade.topics ?? []), ...(grade.words ?? [])].map((t, i) => (
              <span key={i} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-[var(--night-text-70)]">
                {t}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {grade.rewrites && grade.rewrites.length > 0 && (
        <Section title="Как сказать лучше">
          <div className="flex flex-col gap-1.5">
            {grade.rewrites.map((r, i) => (
              <div key={i} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <p className="text-[var(--night-text-40)]">{r.was}</p>
                <p className="text-emerald-300">→ {r.better}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Chip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-[var(--night-text-40)]'
      }`}
    >
      {ok ? <IconCheck size={12} /> : <IconClose size={12} />}
      {label}
    </span>
  )
}
