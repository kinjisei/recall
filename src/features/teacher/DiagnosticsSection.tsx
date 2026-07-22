// ============================================================================
// Диагностическая карта ученицы — раскрывашка в карточке ученицы у
// преподавателя. Показывает сильные/слабые места из реальных данных:
// слова (статусы FSRS + «буксующие»), задания (средний балл + разбивка по
// категориям упражнений), грамматические ошибки по темам (grammar_mistakes),
// AI-квесты, активность за 14 дней. Данные — lib/diagnostics.ts, только чтение.
// ============================================================================
import { useEffect, useState } from 'react'
import { getStudentDiagnostics, type StudentDiagnostics } from '../../lib/diagnostics'
import type { AppLang, GrammarTopic, MaterialExerciseKind } from '../../types'

const KIND_LABELS: Record<MaterialExerciseKind, string> = {
  comprehension: 'Понимание текста',
  grammar: 'Грамматика',
  vocab: 'Лексика',
}

const LANG_FLAG: Record<AppLang, string> = { en: 'EN', es: 'ES' }

/** Заголовки грамматических тем: lang:topicId → название урока. */
type TopicTitles = Map<string, { title: string; level: string }>

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] px-3 py-2 text-center">
      <p className={`text-lg font-bold ${tone ?? 'text-[var(--night-text)]'}`}>{value}</p>
      <p className="text-[11px] leading-tight text-[var(--night-text-40)]">{label}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--night-text-40)]">
      {children}
    </p>
  )
}

/** Процент → цвет: слабое место должно бросаться в глаза. */
function pctTone(pct: number): string {
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-amber-300'
  return 'text-red-400'
}

export function DiagnosticsSection({ studentId }: { studentId: string }) {
  const [diag, setDiag] = useState<StudentDiagnostics | null>(null)
  const [titles, setTitles] = useState<TopicTitles>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getStudentDiagnostics(studentId)
      .then(async (d) => {
        if (!alive) return
        setDiag(d)
        // названия тем — из ленивых данных грамматики (только нужные языки)
        const langs = [...new Set(d.mistakes.map((m) => m.lang))]
        const map: TopicTitles = new Map()
        for (const lang of langs) {
          const mod =
            lang === 'es'
              ? await import('../../data/spanish/grammar')
              : await import('../../data/english/grammar')
          for (const t of mod.grammarTopics as GrammarTopic[]) {
            map.set(`${lang}:${t.id}`, { title: t.title, level: t.level })
          }
        }
        if (alive) setTitles(map)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Не удалось загрузить диагностику')
      })
    return () => {
      alive = false
    }
  }, [studentId])

  if (error) return <p className="text-sm text-red-400">{error}</p>
  if (!diag) return <p className="text-sm text-[var(--night-text-40)]">Собираю карту…</p>

  const w = diag.words
  const kinds = (Object.keys(KIND_LABELS) as MaterialExerciseKind[])
    .map((k) => ({ kind: k, ...diag.kindTotals[k] }))
    .filter((k) => k.total > 0)
  const activeQuests = diag.quests.filter((q) => q.status === 'assigned')
  const doneQuests = diag.quests.filter((q) => q.status === 'completed')

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] p-3">
      {/* активность */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="дней из 14 активна"
          value={diag.activeDays14}
          tone={diag.activeDays14 >= 7 ? 'text-emerald-400' : diag.activeDays14 >= 3 ? 'text-amber-300' : 'text-red-400'}
        />
        <Stat label="слов в колоде" value={w.total} />
        <Stat
          label="средний балл работ"
          value={diag.avgPercent !== null ? `${diag.avgPercent}%` : '—'}
          tone={diag.avgPercent !== null ? pctTone(diag.avgPercent) : undefined}
        />
      </div>

      {/* слова */}
      <SectionTitle>Слова</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="новые" value={w.fresh} />
        <Stat label="учатся" value={w.learning} tone="text-amber-300" />
        <Stat label="выучено" value={w.learned} tone="text-emerald-400" />
      </div>
      {w.struggling.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-[var(--night-text-40)]">
            Буксуют (частые срывы — стоит перепроверить):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {w.struggling.map((s) => (
              <span
                key={s.front}
                className="rounded-lg bg-red-400/10 px-2 py-1 text-xs text-red-300"
                title={s.back ?? undefined}
              >
                {s.front} ×{s.lapses}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* задания */}
      {(diag.assignments.length > 0 || kinds.length > 0) && (
        <>
          <SectionTitle>Задания</SectionTitle>
          {kinds.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {kinds.map(({ kind, ok, total }) => {
                const pct = Math.round((ok / total) * 100)
                return (
                  <div key={kind} className="flex items-center gap-2 text-sm">
                    <span className="w-36 shrink-0 text-[var(--night-text-70)]">
                      {KIND_LABELS[kind]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-300' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`w-14 shrink-0 text-right text-xs ${pctTone(pct)}`}>
                      {ok}/{total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {diag.assignments.length > 0 && (
            <ul className="flex flex-col gap-1">
              {diag.assignments.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-[var(--night-text-70)]">
                    {LANG_FLAG[a.lang]} · {a.title}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${a.percent !== null ? pctTone(a.percent) : 'text-[var(--night-text-40)]'}`}
                  >
                    {a.percent !== null
                      ? `${a.percent}%`
                      : a.status === 'assigned'
                        ? 'не сдано'
                        : 'на проверке'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* грамматика */}
      <SectionTitle>Грамматика — слабые темы</SectionTitle>
      {!diag.mistakesAvailable ? (
        <p className="text-xs text-amber-300">
          Таблица ошибок ещё не создана — выполни блок «ДИАГНОСТИКА» из docs/schema.sql.
        </p>
      ) : diag.mistakes.length === 0 ? (
        <p className="text-xs text-[var(--night-text-40)]">
          Ошибок пока не накоплено. Они появляются, когда ученица решает
          упражнения в грамматике (копятся с момента обновления приложения).
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {diag.mistakes.map((m) => {
            const t = titles.get(`${m.lang}:${m.topicId}`)
            return (
              <li
                key={`${m.lang}:${m.topicId}`}
                className="flex items-baseline justify-between gap-2 text-sm"
              >
                <span className="min-w-0 truncate text-[var(--night-text-70)]">
                  {LANG_FLAG[m.lang]} · {t ? `${t.level} · ${t.title}` : `тема №${m.topicId}`}
                </span>
                <span className="shrink-0 text-xs text-red-300">
                  ошибок: {m.count}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {/* квесты */}
      {diag.quests.length > 0 && (
        <>
          <SectionTitle>AI-квесты</SectionTitle>
          <p className="text-sm text-[var(--night-text-70)]">
            Активных: {activeQuests.length} · завершено: {doneQuests.length}
            {activeQuests.length > 0 && (
              <span className="text-[var(--night-text-40)]">
                {' '}
                (
                {activeQuests
                  .map((q) => `${q.topic} ${q.progress}/${q.target}`)
                  .join(', ')}
                )
              </span>
            )}
          </p>
        </>
      )}

      <p className="text-[11px] text-[var(--night-text-25)]">
        Последнее занятие: {diag.lastActiveDay ?? 'не было'} · карта собирается из
        колоды, заданий, грамматики и квестов автоматически.
      </p>
    </div>
  )
}
