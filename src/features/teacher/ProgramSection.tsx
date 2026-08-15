// ============================================================================
// Программа обучения — сторона преподавателя (раскрывашка в карточке ученика):
// AI (tier max) составляет недельный план по уровню + цели + диагностике,
// преподаватель смотрит предпросмотр, просит правки или сохраняет; активная
// программа показывается с подсветкой текущей недели. Данные — lib/studyPlan.
// ============================================================================
import { useCallback, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { Picker } from '../../components/Picker'
import { useAsyncData } from '../../lib/useAsyncData'
import {
  archivePlan,
  currentWeekIndex,
  generateStudyPlan,
  getActivePlan,
  saveStudyPlan,
  type GeneratedPlan,
  type PlanRequest,
} from '../../lib/studyPlan'
import { PlanView } from '../program/PlanView'
import type { AppLang, StudyPlan } from '../../types'
import { RowsSkeleton } from '../../components/Loading'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
const WEEK_OPTIONS = [2, 3, 4, 6, 8] as const

const inputCls =
  'w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)]'

export function ProgramSection({ studentId }: { studentId: string }) {
  const [lang, setLang] = useState<AppLang>('en')
  const [mode, setMode] = useState<'view' | 'form'>('view')

  // активная программа выбранного языка
  const load = useCallback(() => getActivePlan(studentId, lang), [studentId, lang])
  const { data: plan, error, loading, reload } = useAsyncData<StudyPlan | null>(
    load,
    [studentId, lang],
    'Не удалось загрузить программу',
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] p-3">
      <div className="flex gap-2">
        {(['en', 'es'] as AppLang[]).map((l) => (
          <button
            key={l}
            onClick={() => {
              setLang(l)
              setMode('view')
            }}
            className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold ${
              lang === l
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <RowsSkeleton count={2} height={56} />
      ) : error ? (
        // до выполнения SQL таблицы нет — подсказываем, не падаем
        error.includes('study_plans') ? (
          <p className="text-xs text-amber-300">
            Таблица программ ещё не создана — выполни блок «ПРОГРАММА ОБУЧЕНИЯ» из docs/schema.sql.
          </p>
        ) : (
          <LoadError message={error} onRetry={reload} />
        )
      ) : mode === 'form' || !plan ? (
        <PlanForm
          studentId={studentId}
          lang={lang}
          hasActive={!!plan}
          onCancel={plan ? () => setMode('view') : undefined}
          onSaved={() => {
            setMode('view')
            reload()
          }}
        />
      ) : (
        <ActivePlanView plan={plan} onChanged={reload} onNew={() => setMode('form')} />
      )}
    </div>
  )
}

function ActivePlanView({
  plan,
  onChanged,
  onNew,
}: {
  plan: StudyPlan
  onChanged: () => void
  onNew: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const week = currentWeekIndex(plan)

  const remove = async () => {
    if (archiving) return
    if (!confirm('Снять программу? Ученик перестанет её видеть.')) return
    setArchiving(true)
    try {
      await archivePlan(plan.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось снять программу')
      setArchiving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--night-text-40)]">
        Уровень {plan.level} · {plan.weeks.length} нед. · старт {plan.start_day} · неделя {week} из{' '}
        {plan.weeks.length}
      </p>
      {plan.summary && (
        <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs leading-relaxed text-[var(--night-text-60)]">
          {plan.summary}
        </p>
      )}
      <PlanView weeks={plan.weeks} currentWeek={week} />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="px-3 py-2 text-sm"
          onClick={onNew}
          disabled={archiving}
        >
          Составить новую
        </Button>
        <Button
          variant="ghost"
          className="px-3 py-2 text-sm"
          onClick={remove}
          loading={archiving}
        >
          Снять программу
        </Button>
      </div>
    </div>
  )
}

function PlanForm({
  studentId,
  lang,
  hasActive,
  onCancel,
  onSaved,
}: {
  studentId: string
  lang: AppLang
  hasActive: boolean
  onCancel?: () => void
  onSaved: () => void
}) {
  const [level, setLevel] = useState<string>('B1')
  const [weeks, setWeeks] = useState<number>(4)
  const [goal, setGoal] = useState('')
  const [feedback, setFeedback] = useState('')
  const [preview, setPreview] = useState<GeneratedPlan | null>(null)
  const [busy, setBusy] = useState<'gen' | 'save' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const req: PlanRequest = { studentId, lang, level, weeks, goal }

  const generate = async (withFeedback?: string) => {
    setBusy('gen')
    setErr(null)
    try {
      setPreview(await generateStudyPlan(req, withFeedback))
      setFeedback('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось составить программу')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!preview) return
    if (hasActive && !confirm('Прошлая программа уйдёт в архив. Сохранить новую?')) return
    setBusy('save')
    setErr(null)
    try {
      await saveStudyPlan(req, preview)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!preview ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
              Уровень ученика
              <Picker
                value={level}
                onChange={setLevel}
                label="Уровень ученика"
                options={LEVELS.map((l) => ({ id: l, label: l }))}
              />
            </div>
            <div className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
              Недель
              <Picker
                value={String(weeks)}
                onChange={(id) => setWeeks(Number(id))}
                label="Недель"
                options={WEEK_OPTIONS.map((n) => ({ id: String(n), label: String(n) }))}
              />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
            Цель / пожелания (необязательно)
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="Например: подготовка к поездке, упор на разговорную речь…"
              className={inputCls}
            />
          </label>
          <p className="text-xs text-[var(--night-text-40)]">
            AI учтёт диагностику ученика: слабые темы грамматики, буксующие слова и баллы по
            заданиям.
          </p>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex gap-2">
            <Button
              className="px-4 py-2 text-sm"
              loading={busy === 'gen'}
              onClick={() => void generate()}
            >
              {busy === 'gen' ? 'Составляю (до минуты)…' : 'Составить программу (AI)'}
            </Button>
            {onCancel && (
              <Button variant="ghost" className="px-3 py-2 text-sm" onClick={onCancel}>
                Отмена
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {preview.summary && (
            <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-xs leading-relaxed text-[var(--night-text-60)]">
              {preview.summary}
            </p>
          )}
          <PlanView weeks={preview.weeks} />
          <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
            Правки (что изменить при пересоставлении)
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="Например: меньше грамматики, добавь больше разговорной практики…"
              className={inputCls}
            />
          </label>
          {err && <p className="text-sm text-red-400">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="px-4 py-2 text-sm" loading={busy === 'save'} onClick={save}>
              Сохранить и назначить
            </Button>
            <Button
              variant="secondary"
              className="px-3 py-2 text-sm"
              loading={busy === 'gen'}
              onClick={() => void generate(feedback.trim() || undefined)}
            >
              Пересоставить
            </Button>
            <Button variant="ghost" className="px-3 py-2 text-sm" onClick={() => setPreview(null)}>
              К форме
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
