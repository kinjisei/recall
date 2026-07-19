// ============================================================================
// «Материалы» преподавателя: генератор текста с упражнениями (двухшаговый:
// форма → план от AI → предпросмотр → сохранить) + библиотека + назначение.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import {
  MATERIAL_FORMATS,
  MATERIAL_LENGTHS,
  assignMaterial,
  deleteMaterial,
  generateMaterialContent,
  generateMaterialPlan,
  listMaterialAssignments,
  listMyMaterials,
  saveMaterial,
  unassignMaterial,
  type MaterialContent,
  type MaterialRequest,
} from '../../lib/materials'
import type { StudentInfo } from '../../lib/teacher'
import { ReviewScreen } from './ReviewScreen'
import type {
  AppLang,
  CEFRLevel,
  Material,
  MaterialAssignment,
  MaterialPlan,
} from '../../types'

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900'

type Mode =
  | { name: 'list' }
  | { name: 'form' }
  | { name: 'plan'; req: MaterialRequest; plan: MaterialPlan }
  | { name: 'preview'; req: MaterialRequest; plan: MaterialPlan; content: MaterialContent }
  | { name: 'detail'; material: Material }

export function MaterialsSection({ students }: { students: StudentInfo[] }) {
  const [mode, setMode] = useState<Mode>({ name: 'list' })
  const [materials, setMaterials] = useState<Material[] | null>(null)

  const reload = useCallback(() => {
    listMyMaterials().then(setMaterials).catch(() => setMaterials([]))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (mode.name === 'form') {
    return (
      <RequestForm
        onCancel={() => setMode({ name: 'list' })}
        onPlanned={(req, plan) => setMode({ name: 'plan', req, plan })}
      />
    )
  }
  if (mode.name === 'plan') {
    return (
      <PlanScreen
        req={mode.req}
        plan={mode.plan}
        onBack={() => setMode({ name: 'form' })}
        onReplanned={(plan) => setMode({ ...mode, plan })}
        onGenerated={(content) => setMode({ name: 'preview', req: mode.req, plan: mode.plan, content })}
      />
    )
  }
  if (mode.name === 'preview') {
    return (
      <PreviewScreen
        req={mode.req}
        plan={mode.plan}
        content={mode.content}
        onRegenerated={(content) => setMode({ ...mode, content })}
        onSaved={(material) => {
          reload()
          setMode({ name: 'detail', material })
        }}
        onBack={() => setMode({ name: 'plan', req: mode.req, plan: mode.plan })}
      />
    )
  }
  if (mode.name === 'detail') {
    return (
      <MaterialDetail
        material={mode.material}
        students={students}
        onDeleted={() => {
          reload()
          setMode({ name: 'list' })
        }}
        onBack={() => setMode({ name: 'list' })}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Генератор учебных текстов: тема, уровень, формат — AI составит план,
          сгенерирует текст и упражнения. Материал можно назначить ученицам или
          просто хранить в библиотеке.
        </p>
        <Button className="mt-3" onClick={() => setMode({ name: 'form' })}>
          + Создать материал
        </Button>
      </Card>

      {materials === null ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : materials.length === 0 ? (
        <p className="text-sm text-slate-400">Пока нет сохранённых материалов.</p>
      ) : (
        materials.map((m) => (
          <button key={m.id} onClick={() => setMode({ name: 'detail', material: m })} className="text-left">
            <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.title ?? m.topic}</p>
                <p className="text-xs text-slate-400">
                  {m.lang.toUpperCase()} · {m.level} · {m.format} · {m.length_range} слов ·{' '}
                  {m.exercises.length} упр.
                </p>
              </div>
              <span className="shrink-0 text-slate-400">›</span>
            </Card>
          </button>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Шаг 1: форма заявки.
// ---------------------------------------------------------------------------

function RequestForm({
  onCancel,
  onPlanned,
}: {
  onCancel: () => void
  onPlanned: (req: MaterialRequest, plan: MaterialPlan) => void
}) {
  const [lang, setLang] = useState<AppLang>('en')
  const [level, setLevel] = useState<CEFRLevel>('A2')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<string>(MATERIAL_FORMATS[0])
  const [lengthRange, setLengthRange] = useState<MaterialRequest['lengthRange']>('100-250')
  const [vocabulary, setVocabulary] = useState('')
  const [grammar, setGrammar] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    const req: MaterialRequest = {
      lang,
      level,
      topic: topic.trim(),
      format,
      lengthRange,
      vocabulary,
      grammar,
    }
    try {
      const plan = await generateMaterialPlan(req)
      onPlanned(req, plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации плана')
    } finally {
      setBusy(false)
    }
  }

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${
      active
        ? 'bg-sky-600 text-white'
        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
    }`

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Новый материал</p>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Язык</p>
        <div className="flex gap-2">
          <button className={chip(lang === 'en')} onClick={() => setLang('en')}>Английский</button>
          <button className={chip(lang === 'es')} onClick={() => setLang('es')}>Испанский</button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Уровень ученика</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Тема текста *</p>
        <input
          className={inputClass}
          placeholder="Например: Путешествие в горы"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Формат</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_FORMATS.map((f) => (
            <button key={f} className={chip(format === f)} onClick={() => setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">Длина (слов)</p>
        <div className="flex gap-2">
          {MATERIAL_LENGTHS.map((l) => (
            <button key={l} className={chip(lengthRange === l)} onClick={() => setLengthRange(l)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">
          Слова через запятую или тема словаря (необязательно)
        </p>
        <input
          className={inputClass}
          placeholder="mountain, tent, campfire — или просто «поход»"
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-500">
          Грамматическая тема (необязательно)
        </p>
        <input
          className={inputClass}
          placeholder="there is / there are"
          value={grammar}
          onChange={(e) => setGrammar(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={busy || !topic.trim()}>
          {busy ? 'AI составляет план…' : 'Составить план →'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Шаг 2: план от AI — проверка и правки.
// ---------------------------------------------------------------------------

function PlanScreen({
  req,
  plan,
  onBack,
  onReplanned,
  onGenerated,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  onBack: () => void
  onReplanned: (plan: MaterialPlan) => void
  onGenerated: (content: MaterialContent) => void
}) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState<'replan' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const replan = async () => {
    setBusy('replan')
    setError(null)
    try {
      onReplanned(await generateMaterialPlan(req, feedback.trim() || undefined))
      setFeedback('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    setBusy('generate')
    setError(null)
    try {
      onGenerated(await generateMaterialContent(req, plan, feedback.trim() || undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← К форме
        </Button>
        <p className="font-semibold">План материала от AI</p>
      </div>

      <Card className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
          {plan.comments}
        </p>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Целевые слова</p>
          <div className="flex flex-wrap gap-1.5">
            {plan.vocabulary.map((w, i) => (
              <span key={i} className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                {w}
              </span>
            ))}
          </div>
        </div>

        {plan.grammar_focus && (
          <p className="text-sm">
            <span className="text-xs font-semibold text-slate-500">Грамматика: </span>
            {plan.grammar_focus}
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-500">Упражнения</p>
          {plan.exercise_plan.map((p, i) => (
            <p key={i} className="text-sm text-slate-600 dark:text-slate-300">
              • {p.kind === 'comprehension' ? 'Понимание текста' : p.kind === 'grammar' ? 'Грамматика' : 'Словарь'}:{' '}
              {p.count} шт. — {p.note}
            </p>
          ))}
        </div>
      </Card>

      <textarea
        className={`${inputClass} min-h-[64px]`}
        placeholder="Правки к плану (необязательно): «замени слово X», «добавь вопросов»…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        disabled={busy !== null}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={replan} disabled={busy !== null}>
          {busy === 'replan' ? 'Пересоставляю…' : '↻ Пересоставить план'}
        </Button>
        <Button className="flex-1" onClick={generate} disabled={busy !== null}>
          {busy === 'generate' ? 'Генерирую…' : 'Генерировать ✓'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Шаг 3: предпросмотр материала (с ответами) — сохранить или перегенерировать.
// ---------------------------------------------------------------------------

function PreviewScreen({
  req,
  plan,
  content,
  onRegenerated,
  onSaved,
  onBack,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  content: MaterialContent
  onRegenerated: (content: MaterialContent) => void
  onSaved: (material: Material) => void
  onBack: () => void
}) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState<'regen' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const regen = async () => {
    setBusy('regen')
    setError(null)
    try {
      onRegenerated(await generateMaterialContent(req, plan, feedback.trim() || undefined))
      setFeedback('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    try {
      onSaved(await saveMaterial(req, plan, content))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
    }
  }

  const wordCount = content.body.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← К плану
        </Button>
        <p className="min-w-0 truncate font-semibold">Предпросмотр</p>
      </div>

      <Card>
        <p className="text-lg font-bold">{content.title}</p>
        <p className="mt-1 text-xs text-slate-400">
          {req.level} · {req.format} · ~{wordCount} слов
        </p>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
          {content.body}
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Упражнения ({content.exercises.length}) — с ответами</p>
        {content.exercises.map((e, i) => (
          <div key={i} className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
            <p className="text-xs text-slate-400">
              {i + 1}. {e.kind === 'comprehension' ? 'понимание' : e.kind === 'grammar' ? 'грамматика' : 'словарь'}
            </p>
            <p className="mt-0.5">{e.prompt}</p>
            {e.type === 'mcq' && (
              <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                ✓ {e.options[e.answer]}
                <span className="text-slate-400"> (из: {e.options.join(' · ')})</span>
              </p>
            )}
            {e.type === 'fill' && (
              <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓ {e.answer}</p>
            )}
          </div>
        ))}
      </Card>

      <textarea
        className={`${inputClass} min-h-[64px]`}
        placeholder="Правки (необязательно): «сделай текст проще», «поменяй вопрос 3»…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        disabled={busy !== null}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={regen} disabled={busy !== null}>
          {busy === 'regen' ? 'Генерирую…' : '↻ Перегенерировать'}
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy !== null}>
          {busy === 'save' ? 'Сохраняю…' : '💾 Сохранить'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Карточка сохранённого материала: назначение ученицам, удаление.
// ---------------------------------------------------------------------------

function MaterialDetail({
  material,
  students,
  onDeleted,
  onBack,
}: {
  material: Material
  students: StudentInfo[]
  onDeleted: () => void
  onBack: () => void
}) {
  const [assignments, setAssignments] = useState<MaterialAssignment[] | null>(null)
  const [busyStudent, setBusyStudent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBody, setShowBody] = useState(false)
  const [reviewing, setReviewing] = useState<{ a: MaterialAssignment; name: string } | null>(null)

  const reload = useCallback(() => {
    listMaterialAssignments(material.id).then(setAssignments).catch(() => setAssignments([]))
  }, [material.id])

  useEffect(() => {
    reload()
  }, [reload])

  const assignedIds = new Set((assignments ?? []).map((a) => a.student_id))

  const toggle = async (studentId: string) => {
    setBusyStudent(studentId)
    setError(null)
    try {
      if (assignedIds.has(studentId)) await unassignMaterial(material.id, studentId)
      else await assignMaterial(material.id, studentId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyStudent(null)
    }
  }

  const remove = async () => {
    if (!window.confirm('Удалить материал? Назначения учениц тоже удалятся.')) return
    try {
      await deleteMaterial(material.id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  if (reviewing) {
    return (
      <ReviewScreen
        material={material}
        assignment={reviewing.a}
        studentName={reviewing.name}
        onDone={() => {
          setReviewing(null)
          reload()
        }}
        onBack={() => setReviewing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Материалы
        </Button>
        <p className="min-w-0 truncate font-semibold">{material.title ?? material.topic}</p>
      </div>

      <Card>
        <p className="text-xs text-slate-400">
          {material.lang.toUpperCase()} · {material.level} · {material.format} ·{' '}
          {material.length_range} слов · {material.exercises.length} упр.
        </p>
        <button
          onClick={() => setShowBody((s) => !s)}
          className="mt-2 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          {showBody ? '▾ Скрыть текст' : '▸ Показать текст'}
        </button>
        {showBody && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {material.body}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Назначить ученицам</p>
        {students.length === 0 ? (
          <p className="text-sm text-slate-400">Пока нет привязанных учениц.</p>
        ) : (
          students.map((s) => {
            const a = (assignments ?? []).find((x) => x.student_id === s.profile.id)
            const name = s.profile.display_name ?? 'Без имени'
            const teacherOk = (a?.teacher_review ?? []).filter((r) => r.ok).length
            return (
              <div
                key={s.profile.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  {a && (
                    <p className="text-xs text-slate-400">
                      {a.status === 'assigned'
                        ? 'ещё не выполнено'
                        : a.status === 'submitted'
                          ? `⏳ на проверке · авто ${a.auto_score}/${a.auto_total}`
                          : `✓ проверено: ${teacherOk}/${a.auto_total}`}
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
                    onClick={() => toggle(s.profile.id)}
                  >
                    {busyStudent === s.profile.id ? '…' : a ? 'Убрать ✓' : 'Назначить'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <Button variant="ghost" className="self-start text-sm text-red-500" onClick={remove}>
        🗑 Удалить материал
      </Button>
    </div>
  )
}
