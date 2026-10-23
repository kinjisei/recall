// ============================================================================
// «План дня» — что ученик делает каждый день (карточка под программой, макет
// d11-3): «Слова (повторение)» — всегда в плане (ядро FSRS); учитель добавляет
// чтение, грамматику, речь, диалог; «Задания и квесты» сами подмешивают
// несданные задания и активные квесты. Ничего не выбрано (null) — приложение
// строит свой план из 3 пунктов («Вернуть план приложения»).
// Вид — карточка раздела со строками-галочками и «Сохранить план» справа от
// заголовка; подписи — что пункт делает сейчас (журнал п.76 (9)): с неделей
// программы план дня не связан. Хранение: teacher_students.daily_plan через
// RPC set_daily_plan.
// ============================================================================
import { useState } from 'react'
import { getStudentDailyPlan, setDailyPlan, type DailyPlanConfig, type PlanKind } from '../../lib/dailyPlan'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { IconCheck } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { SectionCard } from './sectionBits'
import { ErrorText } from '../../shared/ui/ErrorText'

const KINDS: { kind: PlanKind; label: string; hint: string }[] = [
  { kind: 'reader', label: 'Чтение', hint: 'текст и новые слова' },
  { kind: 'grammar', label: 'Грамматика', hint: 'урок или тренажёр' },
  { kind: 'pronunciation', label: 'Речь', hint: 'произношение вслух' },
  { kind: 'conversation', label: 'Диалог с AI', hint: 'разговор или письмо' },
]

export function DailyPlanSection({ studentId, name }: { studentId: string; name: string }) {
  const { data, error, loading, reload } = useAsyncData<DailyPlanConfig | null>(() => getStudentDailyPlan(studentId), [studentId], 'Не удалось загрузить план дня')
  // undefined — ещё не трогали (показываем сохранённое)
  const [draft, setDraft] = useState<DailyPlanConfig | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const cfg = draft !== undefined ? draft : data
  const kinds = cfg?.kinds ?? []
  const auto = cfg?.auto !== false
  const change = (next: DailyPlanConfig) => {
    setDraft(next)
    setNotice(null)
  }

  const save = async (value: DailyPlanConfig | null) => {
    setBusy(true)
    setErr(null)
    try {
      await setDailyPlan(studentId, value)
      setDraft(undefined)
      setNotice(value ? 'План сохранён — ученик увидит его на Главной' : 'Вернулся план приложения')
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      title="План дня"
      note={`что ${name} делает каждый день`}
      action={
        !loading &&
        !error && (
          <Button variant="outline" loading={busy} disabled={draft === undefined} onClick={() => void save({ kinds, auto })}>
            Сохранить план
          </Button>
        )
      }
    >
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading ? (
        <RowsSkeleton count={3} height={52} />
      ) : (
        <>
          <div className="flex flex-col divide-y divide-line" data-daily-plan>
            <Row label="Слова (повторение)" hint="всегда в плане" on locked />
            {KINDS.map(({ kind, label, hint }) => (
              <Row
                key={kind}
                label={label}
                hint={hint}
                on={kinds.includes(kind)}
                onToggle={() => change({ kinds: kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind], auto })}
              />
            ))}
            <Row label="Задания и квесты" hint="сами попадают в план" on={auto} onToggle={() => change({ kinds, auto: !auto })} />
          </div>
          {err && (
            <ErrorText>
              {err}
            </ErrorText>
          )}
          {notice && <p className="text-sm text-success-strong">{notice}</p>}
          {(data || draft) && (
            <Button variant="ghost" className="-ml-2 self-start px-2" disabled={busy} onClick={() => void save(null)}>
              Вернуть план приложения
            </Button>
          )}
        </>
      )}
    </SectionCard>
  )
}

/** Строка-галочка (d11-3 `.dr11`): квадрат 22, подпись и пояснение; «всегда в плане» — серая и не нажимается. */
function Row({ label, hint, on, locked = false, onToggle }: { label: string; hint: string; on: boolean; locked?: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-disabled={locked || undefined}
      onClick={locked ? undefined : onToggle}
      className={`flex min-h-13 items-center gap-3 py-1 text-left ${locked ? 'cursor-default' : 'active:bg-row-press'}`}
    >
      <span
        aria-hidden
        className={`flex size-5.5 flex-none items-center justify-center rounded-md ${
          locked ? 'bg-input text-fg-muted' : on ? 'bg-primary text-primary-fg' : 'bg-surface inset-ring-2 inset-ring-fg-faint'
        }`}
      >
        {on && <IconCheck size={14} />}
      </span>
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="text-body text-fg">{label}</span>
        <small className="text-note text-fg-muted">{hint}</small>
      </span>
    </button>
  )
}
