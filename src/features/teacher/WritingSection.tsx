// ============================================================================
// «Письмо» — задания на письменную работу у преподавателя (Заход 5a):
// список → форма создания (IELTS / обычное эссе) → карточка с назначением.
// Оценка и проверка работ — в 5b/5c. Механика назначения — как в «Материалах».
// ============================================================================
import { useState } from 'react'

import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { BackHeader } from '../../components/BackButton'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import {
  createWritingTask,
  listMyWritingTasks,
  deleteWritingTask,
  assignWritingTask,
  unassignWritingTask,
  listWritingAssignments,
  generateIeltsQuestion,
  generateChartTask,
} from '../../lib/writing'
import type { StudentInfo } from '../../lib/teacher'
import type {
  AppLang,
  CEFRLevel,
  ChartSpec,
  WritingMode,
  WritingSettings,
  WritingTask,
  WritingTaskAssignment,
} from '../../types'
import { LEVELS, inputClass } from './materials/shared'
import { ChartView } from '../../components/ChartView'
import { WritingReviewScreen } from '../writing/WritingReviewScreen'
import { AppLink } from '../../components/AppLink'
import { RowsSkeleton } from '../../components/Loading'

const CHART_KINDS: { id: ChartSpec['kind']; label: string }[] = [
  { id: 'bar', label: 'Столбцы' },
  { id: 'line', label: 'Линия' },
  { id: 'pie', label: 'Круговая' },
  { id: 'table', label: 'Таблица' },
]

const BANDS = ['5.5', '6.0', '6.5', '7.0', '7.5', '8.0']

function chipCls(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm font-semibold ${
    active
      ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
      : 'bg-white/[0.07] text-[var(--night-text-70)]'
  }`
}

export function WritingSection({ students }: { students: StudentInfo[] }) {
  const [screen, setScreen] = useState<'list' | 'form' | { task: WritingTask }>('list')
  const { data: tasks, error, loading, reload } = useAsyncData<WritingTask[]>(
    () => listMyWritingTasks(),
    [],
    'Не удалось загрузить задания',
  )

  if (screen === 'form') {
    return (
      <WritingForm
        onCancel={() => setScreen('list')}
        onCreated={(t) => {
          reload()
          setScreen({ task: t })
        }}
      />
    )
  }
  if (typeof screen === 'object') {
    return (
      <WritingDetail
        task={screen.task}
        students={students}
        onBack={() => setScreen('list')}
        onDeleted={() => {
          reload()
          setScreen('list')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Письменные задания</p>
        <Button className="px-3 py-1.5 text-sm" onClick={() => setScreen('form')}>
          + Новое письмо
        </Button>
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading ? (
        <RowsSkeleton count={2} height={56} />
      ) : (tasks ?? []).length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Пока нет заданий</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Создай письмо в режиме IELTS или обычного эссе и назначь ученикам.
          </p>
        </Card>
      ) : (
        (tasks ?? []).map((t) => (
          <button
            key={t.id}
            onClick={() => setScreen({ task: t })}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-left transition-transform active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.prompt}</p>
              <p className="text-xs text-[var(--night-text-40)]">
                {t.mode === 'ielts'
                  ? `IELTS · ${t.settings?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}${
                      t.settings?.targetBand ? ` · band ${t.settings.targetBand}` : ''
                    }`
                  : `Эссе · ${t.lang === 'es' ? 'ES' : 'EN'} · ${t.level}`}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Форма создания.
// ---------------------------------------------------------------------------

function WritingForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (task: WritingTask) => void
}) {
  const [mode, setMode] = useState<WritingMode>('ielts')
  const [lang, setLang] = useState<AppLang>('en')
  const [level, setLevel] = useState<CEFRLevel>('B1')
  const [ieltsTask, setIeltsTask] = useState<'task2' | 'gt1' | 'academic1'>('task2')
  const [targetBand, setTargetBand] = useState('6.5')
  const [chartKind, setChartKind] = useState<ChartSpec['kind']>('bar')
  const [chartTopic, setChartTopic] = useState('')
  const [chart, setChart] = useState<ChartSpec | null>(null)
  const [prompt, setPrompt] = useState('')
  const [targetWords, setTargetWords] = useState('')
  const [targetGrammar, setTargetGrammar] = useState('')
  const [minWords, setMinWords] = useState('150')
  const [busy, setBusy] = useState<'gen' | 'chart' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const genQuestion = async () => {
    setBusy('gen')
    setError(null)
    try {
      setPrompt(await generateIeltsQuestion(ieltsTask === 'gt1' ? 'gt1' : 'task2'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации вопроса')
    } finally {
      setBusy(null)
    }
  }

  const genChart = async () => {
    setBusy('chart')
    setError(null)
    try {
      const { prompt: p, chart: ch } = await generateChartTask(chartKind, chartTopic)
      setChart(ch)
      setPrompt(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации графика')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!prompt.trim() || busy) return
    setBusy('save')
    setError(null)
    const settings: WritingSettings =
      mode === 'ielts'
        ? {
            ieltsTask,
            targetBand: Number(targetBand),
            ...(ieltsTask === 'academic1' && chart ? { chart } : {}),
          }
        : {
            targetWords: targetWords.split(',').map((w) => w.trim()).filter(Boolean),
            targetGrammar: targetGrammar.split(',').map((w) => w.trim()).filter(Boolean),
            minWords: Number(minWords) || 0,
          }
    try {
      const task = await createWritingTask({
        lang: mode === 'ielts' ? 'en' : lang,
        mode,
        level,
        prompt: prompt.trim(),
        settings,
      })
      onCreated(task)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onCancel} title="Новое письмо" label="К списку" />

      <Card className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Режим</p>
          <div className="flex gap-2">
            <button className={chipCls(mode === 'ielts')} onClick={() => setMode('ielts')}>IELTS</button>
            <button className={chipCls(mode === 'regular')} onClick={() => setMode('regular')}>Обычное эссе</button>
          </div>
        </div>

        {mode === 'ielts' ? (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Тип</p>
              <div className="flex flex-wrap gap-2">
                <button className={chipCls(ieltsTask === 'task2')} onClick={() => setIeltsTask('task2')}>Task 2 (эссе)</button>
                <button className={chipCls(ieltsTask === 'gt1')} onClick={() => setIeltsTask('gt1')}>GT Task 1 (письмо)</button>
                <button className={chipCls(ieltsTask === 'academic1')} onClick={() => setIeltsTask('academic1')}>Academic Task 1 (график)</button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Целевой балл (band)</p>
              <div className="flex flex-wrap gap-2">
                {BANDS.map((b) => (
                  <button key={b} className={chipCls(targetBand === b)} onClick={() => setTargetBand(b)}>{b}</button>
                ))}
              </div>
            </div>

            {ieltsTask === 'academic1' && (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Тип графика</p>
                  <div className="flex flex-wrap gap-2">
                    {CHART_KINDS.map((k) => (
                      <button key={k.id} className={chipCls(chartKind === k.id)} onClick={() => setChartKind(k.id)}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  className={inputClass}
                  placeholder="Тема данных (необязательно): население, продажи, температуры…"
                  value={chartTopic}
                  onChange={(e) => setChartTopic(e.target.value)}
                />
                <Button variant="secondary" className="self-start px-3 py-2 text-sm" onClick={genChart} loading={busy === 'chart'} disabled={busy !== null}>
                  {busy === 'chart' ? 'AI рисует данные…' : '📊 Сгенерировать график'}
                </Button>
                {chart && (
                  <div className="rounded-xl border border-white/[0.08] p-3">
                    <ChartView chart={chart} />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Язык</p>
              <div className="flex gap-2">
                <button className={chipCls(lang === 'en')} onClick={() => setLang('en')}>Английский</button>
                <button className={chipCls(lang === 'es')} onClick={() => setLang('es')}>Испанский</button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Уровень ученика</p>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button key={l} className={chipCls(level === l)} onClick={() => setLevel(l)}>{l}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--night-text-40)]">
              {mode === 'ielts' ? 'Вопрос задания' : 'Тема / задание'}
            </p>
            {mode === 'ielts' && ieltsTask !== 'academic1' && (
              <button
                onClick={genQuestion}
                disabled={busy !== null}
                className="text-xs font-semibold text-[var(--night-accent-text)] disabled:opacity-50"
              >
                {busy === 'gen' ? 'AI придумывает…' : '✨ Придумать вопрос'}
              </button>
            )}
          </div>
          <textarea
            className={`${inputClass} min-h-[96px]`}
            placeholder={
              mode === 'ielts'
                ? 'Вставь или сгенерируй вопрос IELTS…'
                : 'Например: Напиши письмо другу о своём последнем путешествии.'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {mode === 'regular' && (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">
                Целевые слова через запятую (необязательно)
              </p>
              <input
                className={inputClass}
                placeholder="journey, adventure, unforgettable"
                value={targetWords}
                onChange={(e) => setTargetWords(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">
                Целевая грамматика через запятую (необязательно)
              </p>
              <input
                className={inputClass}
                placeholder="Past Simple, used to"
                value={targetGrammar}
                onChange={(e) => setTargetGrammar(e.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">
                Минимум слов (необязательно)
              </p>
              <input
                className={inputClass}
                inputMode="numeric"
                placeholder="150"
                value={minWords}
                onChange={(e) => setMinWords(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={busy !== null || !prompt.trim()}>
            {busy === 'save' ? 'Создаю…' : 'Создать →'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy !== null}>
            Отмена
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Карточка задания: назначение ученикам + удаление.
// ---------------------------------------------------------------------------

function WritingDetail({
  task,
  students,
  onBack,
  onDeleted,
}: {
  task: WritingTask
  students: StudentInfo[]
  onBack: () => void
  onDeleted: () => void
}) {
  const { data: assignments, error, loading, reload } = useAsyncData<WritingTaskAssignment[]>(
    () => listWritingAssignments(task.id),
    [task.id],
    'Не удалось загрузить назначения',
  )
  const [busyStudent, setBusyStudent] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<{ a: WritingTaskAssignment; name: string } | null>(null)

  if (reviewing) {
    return (
      <WritingReviewScreen
        task={task}
        assignment={reviewing.a}
        studentName={reviewing.name}
        onBack={() => setReviewing(null)}
        onDone={() => {
          setReviewing(null)
          reload()
        }}
      />
    )
  }

  const toggle = async (studentId: string) => {
    if (busyStudent) return
    setBusyStudent(studentId)
    setErr(null)
    const assigned = (assignments ?? []).some((a) => a.student_id === studentId)
    try {
      if (assigned) await unassignWritingTask(task.id, studentId)
      else await assignWritingTask(task.id, studentId)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyStudent(null)
    }
  }

  const remove = async () => {
    if (!confirm('Удалить это задание? Назначения ученикам тоже пропадут.')) return
    setDeleting(true)
    try {
      await deleteWritingTask(task.id)
      onDeleted()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось удалить')
      setDeleting(false)
    }
  }

  const s = task.settings
  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title="Задание" label="К списку" />

      <Card>
        <p className="text-xs text-[var(--night-text-40)]">
          {task.mode === 'ielts'
            ? `IELTS · ${s?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}${s?.targetBand ? ` · целевой band ${s.targetBand}` : ''}`
            : `Обычное эссе · ${task.lang === 'es' ? 'испанский' : 'английский'} · ${task.level}`}
        </p>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{task.prompt}</p>
        {s?.chart && (
          <div className="mt-3 rounded-xl border border-white/[0.08] p-3">
            <ChartView chart={s.chart} />
          </div>
        )}
        {task.mode === 'regular' && (
          <div className="mt-2 flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
            {s?.targetWords?.length ? <p>Слова: {s.targetWords.join(', ')}</p> : null}
            {s?.targetGrammar?.length ? <p>Грамматика: {s.targetGrammar.join(', ')}</p> : null}
            {s?.minWords ? <p>Минимум слов: {s.minWords}</p> : null}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Назначить ученикам</p>
        {error ? (
          <LoadError message={error} onRetry={reload} />
        ) : loading ? (
          <RowsSkeleton count={2} height={56} />
        ) : students.length === 0 ? (
          // то же пустое состояние-тупик, что было в карточке материала
          <p className="text-sm text-[var(--night-text-40)]">
            Учеников пока нет. Отправь код-приглашение — он на вкладке{' '}
            <AppLink to="/teacher" className="text-[var(--night-accent-text)] underline underline-offset-2">
              «Ученики»
            </AppLink>
            . Как только кто-то привяжется, задание назначается в один тап.
          </p>
        ) : (
          students.map((st) => {
            const a = (assignments ?? []).find((x) => x.student_id === st.profile.id)
            const name = st.profile.display_name ?? 'Без имени'
            return (
              <div
                key={st.profile.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  {a && (
                    <p className="text-xs text-[var(--night-text-40)]">
                      {a.status === 'assigned'
                        ? 'ещё не выполнено'
                        : a.status === 'submitted'
                          ? 'на проверке'
                          : `✓ проверено${a.band ? ` · ${a.band}` : ''}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {a && a.status !== 'assigned' && (
                    <Button
                      className="px-3 py-1.5 text-sm"
                      onClick={() => setReviewing({ a, name })}
                    >
                      {a.status === 'submitted' ? 'Проверить' : 'Разбор'}
                    </Button>
                  )}
                  <Button
                    variant={a ? 'ghost' : 'secondary'}
                    className="px-3 py-1.5 text-sm"
                    disabled={busyStudent !== null}
                    onClick={() => toggle(st.profile.id)}
                  >
                    {busyStudent === st.profile.id ? '…' : a ? 'Убрать ✓' : 'Назначить'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
      </Card>

      <Button variant="ghost" className="self-start text-sm text-red-500" onClick={remove} loading={deleting}>
        Удалить задание
      </Button>
    </div>
  )
}
