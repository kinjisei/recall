// ============================================================================
// Диагностическая карта ученицы — раскрывашка в карточке ученицы у
// преподавателя. Показывает сильные/слабые места из реальных данных:
// слова (статусы FSRS + «буксующие»), задания (средний балл + разбивка по
// категориям упражнений), грамматические ошибки по темам (grammar_mistakes),
// AI-квесты, активность за 14 дней. Данные — lib/diagnostics.ts, только чтение.
// ============================================================================
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { getStudentDiagnostics, type StudentDiagnostics } from '../../lib/diagnostics'
import type { MetricDelta } from '../../lib/dynamics'
import { ReportSheet } from './ReportSheet'
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

/**
 * Строка динамики «prev → now» со стрелкой. Стрелка-глиф + цвет (статусные
 * emerald/red, не серийные) — направление читается и без цвета (dataviz:
 * не кодировать смысл одним цветом). moreIsBetter=false — для ошибок.
 */
function TrendRow({
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
  const hasPrev = d.prev !== null
  const diff = hasPrev && d.now !== null ? d.now - (d.prev as number) : null
  const improved = diff !== null && diff !== 0 && diff > 0 === moreIsBetter
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-[var(--night-text-70)]">{label}</span>
      <span className="shrink-0 tabular-nums">
        <span className="text-[var(--night-text-40)]">
          {d.prev === null ? '—' : `${d.prev}${unit}`}
        </span>
        <span className="mx-1 text-[var(--night-text-25)]">→</span>
        <span className="font-semibold">{d.now === null ? '—' : `${d.now}${unit}`}</span>
        {diff !== null && diff !== 0 && (
          <span className={`ml-1.5 text-xs ${improved ? 'text-emerald-400' : 'text-red-400'}`}>
            {diff > 0 ? '↑' : '↓'}
            {Math.abs(diff)}
          </span>
        )}
      </span>
    </div>
  )
}

/** Процент → цвет: слабое место должно бросаться в глаза. */
function pctTone(pct: number): string {
  if (pct >= 80) return 'text-emerald-400'
  if (pct >= 60) return 'text-amber-300'
  return 'text-red-400'
}

export function DiagnosticsSection({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const [diag, setDiag] = useState<StudentDiagnostics | null>(null)
  const [titles, setTitles] = useState<TopicTitles>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

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
      {/* динамика месяца: сейчас vs 30 дней назад */}
      <SectionTitle>Динамика за месяц</SectionTitle>
      <div className="flex flex-col gap-1">
        <TrendRow label="Дней с занятиями" d={diag.dynamics.activeDays} unit="" />
        <TrendRow label="Средний балл работ" d={diag.dynamics.avgScore} unit="%" />
        <TrendRow label="Слов добавлено" d={diag.dynamics.wordsAdded} unit="" />
        <TrendRow
          label="Новых ошибок грамматики"
          d={diag.dynamics.newMistakes}
          unit=""
          moreIsBetter={false}
        />
        <TrendRow label="Идеальных дней (весь план)" d={diag.dynamics.perfectDays} unit="" />
        {diag.dynamics.learnedRecently > 0 && (
          <p className="text-xs text-[var(--night-text-40)]">
            За 30 дней выучено слов: {diag.dynamics.learnedRecently}
          </p>
        )}
      </div>
      <Button
        variant="secondary"
        className="self-start px-3 py-2 text-sm"
        onClick={() => setShowReport(true)}
      >
        🖨 Отчёт для родителей
      </Button>
      {showReport && (
        <ReportSheet
          diag={diag}
          studentName={studentName}
          topicTitle={(lng, id) => titles.get(`${lng}:${id}`)?.title ?? `тема №${id}`}
          onClose={() => setShowReport(false)}
        />
      )}

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
                      ? `${a.percent}%${a.fromAttempt ? ' (прошлая попытка)' : ''}`
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
