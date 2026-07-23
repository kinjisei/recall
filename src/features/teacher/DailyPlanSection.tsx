// ============================================================================
// «План дня» — настройка ежедневных пунктов ученицы (раскрывашка в карточке
// ученицы). Слова включены всегда (ядро FSRS); учитель добавляет 1-3 пункта;
// переключатель «авто» подмешивает несданные задания и активные квесты.
// Ничего не выбрано (null) — приложение строит умный дефолт из 3 пунктов.
// Хранение: teacher_students.daily_plan через RPC set_daily_plan.
// ============================================================================
import { useCallback, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import {
  getStudentDailyPlan,
  setDailyPlan,
  type DailyPlanConfig,
  type PlanKind,
} from '../../lib/dailyPlan'

const KIND_LABELS: { kind: PlanKind; label: string }[] = [
  { kind: 'reader', label: 'Чтение' },
  { kind: 'grammar', label: 'Грамматика' },
  { kind: 'pronunciation', label: 'Речь' },
  { kind: 'conversation', label: 'Диалог с AI' },
]

export function DailyPlanSection({ studentId }: { studentId: string }) {
  const load = useCallback(() => getStudentDailyPlan(studentId), [studentId])
  const { data, error, loading, reload } = useAsyncData<DailyPlanConfig | null>(
    load,
    [studentId],
    'Не удалось загрузить план',
  )

  const [draft, setDraft] = useState<DailyPlanConfig | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (loading) return <p className="text-sm text-[var(--night-text-40)]">Загрузка…</p>
  if (error) return <LoadError message={error} onRetry={reload} />

  // draft: undefined — ещё не трогали (показываем сохранённое)
  const cfg = draft !== undefined ? draft : data
  const kinds = cfg?.kinds ?? []
  const auto = cfg?.auto !== false

  const toggleKind = (k: PlanKind) => {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k]
    setDraft({ kinds: next, auto })
    setNotice(null)
  }

  const save = async (value: DailyPlanConfig | null) => {
    setBusy(true)
    setErr(null)
    try {
      await setDailyPlan(studentId, value)
      setDraft(undefined)
      setNotice(value ? 'План сохранён — ученица увидит его на Главной' : 'Вернулся умный план приложения')
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] p-3">
      <p className="text-xs text-[var(--night-text-40)]">
        Что ученица делает каждый день. «Слова» включены всегда — это ядро
        повторений. Выполнила весь план — получает «идеальный день» ✦ (виден в
        диагностике и отчёте родителям); серия дней при этом растёт от любого
        одного занятия, как раньше.
      </p>

      <label className="flex min-h-[44px] items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 text-sm text-[var(--night-text-40)]">
        <input type="checkbox" checked disabled className="h-4 w-4 accent-[var(--night-accent)]" />
        Слова (повторение) — всегда в плане
      </label>
      {KIND_LABELS.map(({ kind, label }) => (
        <label
          key={kind}
          className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-white/[0.04]"
        >
          <input
            type="checkbox"
            checked={kinds.includes(kind)}
            onChange={() => toggleKind(kind)}
            className="h-4 w-4 accent-[var(--night-accent)]"
          />
          {label}
        </label>
      ))}
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border-t border-white/[0.06] px-3 pt-2 text-sm hover:bg-white/[0.04]">
        <input
          type="checkbox"
          checked={auto}
          onChange={() => {
            setDraft({ kinds, auto: !auto })
            setNotice(null)
          }}
          className="h-4 w-4 accent-[var(--night-accent)]"
        />
        Задания и квесты сами попадают в план
      </label>

      {err && <p className="text-sm text-red-400">{err}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          className="px-4 py-2 text-sm"
          loading={busy}
          disabled={draft === undefined}
          onClick={() => save({ kinds, auto })}
        >
          Сохранить план
        </Button>
        {(data || draft) && (
          <Button
            variant="ghost"
            className="px-3 py-2 text-sm"
            disabled={busy}
            onClick={() => save(null)}
          >
            Вернуть умный дефолт
          </Button>
        )}
      </div>
    </div>
  )
}
