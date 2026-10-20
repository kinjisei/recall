// ============================================================================
// Проверка письма преподавателем (макеты d7-3, d7-4; PLAN.md Ф2.17-4в-1).
// Слева — текст ученика: правки AI отмечены цифрами, нажал — правка справа;
// текст держится в окне. Справа — оценка AI, правки по видам («Грамматика ·
// 2», «Связность · 1») с «Оставить / Убрать», «Твоя проверка» — итоговый балл
// и комментарий, внизу закреплены «Завершить проверку» и «На доработку»
// (текущий цикл уходит в историю attempts, ученик правит поверх прошлого
// текста). Уже 936 — одной колонкой: текст, под ним панель.
// ============================================================================
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { whenDone } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import { finishWritingReview, reassignWriting } from '../../lib/writing'
import { writingKind } from '../../lib/writingLabels'
import type { WritingGrade, WritingTask, WritingTaskAssignment } from '../../types'
import { plural } from '../../shared/lib/plural'
import { useDraftForm } from '../../shared/lib/useDraft'
import { useShellInsets } from '../../shared/lib/shellInsets'
import { ScreenTop } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { TextPanel, useAsideSplit } from '../../shared/ui/layouts'
import { locateFixes, wordCount } from './essayMarks'
import { AiGrade, BandPicker, bandChoices, EssayCard, FixRow, groupFixes, PanelCard } from './reviewParts'
import { WritingHistory } from './WritingHistory'

export function WritingReviewScreen({
  task,
  assignment,
  studentName,
  onBack,
  onDone,
  backLabel = 'Назад',
  pager,
}: {
  task: WritingTask
  assignment: WritingTaskAssignment
  studentName: string
  onBack: () => void
  onDone: () => void
  /** Куда «назад»: «Задания» из хаба, «Задание» из «Письменных заданий». */
  backLabel?: string
  /** Листалка «Работа 1 из 2 ‹ ›» — из «Проверки работ». */
  pager?: ReactNode
}) {
  const ai = assignment.ai_review
  const reviewed = assignment.status === 'reviewed'
  const prev = assignment.teacher_review
  const aiErrors = useMemo(() => ai?.errors ?? [], [ai])
  const essay = assignment.essay ?? ''
  const who = firstName(studentName)
  const split = useAsideSplit()
  const { bottom } = useShellInsets()
  // Проверка — черновик до сохранения (Ф1.14): какие правки AI учитель
  // оставляет (по умолчанию — все), оценка и комментарий ученику.
  const aiBand = (task.mode === 'ielts' ? ai?.band?.toString() : ai?.level) ?? ''
  const [form, field, draft] = useDraftForm(`writing-review:${assignment.id}`, {
    kept: aiErrors.map(() => true),
    band: (reviewed ? prev?.band ?? prev?.level : undefined)?.toString() ?? aiBand,
    comment: prev?.comment ?? '',
  })
  const { kept, band, comment } = form
  const [setKept, setBand, setComment] = [field('kept'), field('band'), field('comment')]
  const [busy, setBusy] = useState<'finish' | 'reassign' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // номер правки — по панели (вид, внутри — по месту в тексте): справа 1…N
  // сверху вниз, в тексте цифра только помогает найти место (d7-3)
  const { marks, groups, number } = useMemo(() => {
    const located = locateFixes(essay, aiErrors)
    const groups = groupFixes(aiErrors, located.number)
    const number: number[] = []
    let k = 0
    for (const g of groups) for (const i of g.items) number[i] = ++k
    return { marks: located.marks, groups, number }
  }, [essay, aiErrors])

  /** Выбрать правку и показать её пару: из текста — правку в панели, из панели — место в тексте. */
  const select = (i: number, from: 'text' | 'panel') => {
    setSelected(i)
    const target = root.current?.querySelector(from === 'text' ? `[data-fix="${number[i]}"]` : `[data-mark="${i}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const buildReview = (): WritingGrade => ({
    ...(ai ?? {}),
    errors: aiErrors.filter((_, i) => kept[i] ?? true),
    comment: comment.trim() || undefined,
    ...(task.mode === 'ielts' ? { band: Number(band) || ai?.band } : { level: band || ai?.level }),
  })

  const finish = async () => {
    setBusy('finish')
    setError(null)
    try {
      await finishWritingReview(assignment.id, buildReview(), band)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setBusy(null)
    }
  }

  const { ask, dialog } = useConfirm()
  const reassign = async () => {
    // системный prompt путал «Отмену» с пустым комментарием — работа уходила на доработку и так
    const note = await ask({
      title: 'Вернуть на доработку?',
      body: 'Ученик поправит работу поверх прошлого текста и сдаст снова; эта попытка уйдёт в историю.',
      field: { label: 'На что обратить внимание', placeholder: 'Необязательно' },
      action: 'На доработку',
      danger: false,
    })
    if (note === null) return
    setBusy('reassign')
    setError(null)
    try {
      // сначала фиксируем текущий вердикт, чтобы он ушёл в историю попытки
      await finishWritingReview(assignment.id, buildReview(), band).catch(() => {})
      await reassignWriting(assignment.id, note)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить')
      setBusy(null)
    }
  }

  const words = wordCount(essay)
  const meta = [
    who,
    `${words} ${plural(words, 'слово', 'слова', 'слов')}`,
    aiErrors.length ? `правки AI отмечены цифрами — нажми, чтобы найти их ${split ? 'справа' : 'ниже'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const kindWord = task.mode === 'ielts' ? 'band' : 'уровень'

  const panel = (
    <>
      {ai && <AiGrade grade={ai} mode={task.mode} />}
      {ai && (aiErrors.length > 0 || ai.strengths?.length || ai.improve?.length || ai.rewrites?.length) ? (
        <PanelCard title="Над чем поработать" note={aiErrors.length ? `все правки · ${aiErrors.length}` : undefined}>
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-1.5">
              <span className="text-note font-semibold text-fg-muted">
                {g.label} · {g.items.length}
              </span>
              {g.items.map((i) => (
                <FixRow
                  key={i}
                  fix={aiErrors[i] ?? { was: '', fix: '' }}
                  n={number[i] ?? i + 1}
                  kept={kept[i] ?? true}
                  selected={selected === i}
                  lang={task.lang}
                  onSelect={() => select(i, 'panel')}
                  onKeep={(keep) => setKept((k) => aiErrors.map((_, j) => (j === i ? keep : k[j] ?? true)))}
                />
              ))}
            </div>
          ))}
          <TextList title="Сильные стороны" items={ai.strengths} />
          <TextList title="Что подтянуть" items={ai.improve} />
          {ai.rewrites && ai.rewrites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-note font-semibold text-fg-muted">Как сказать лучше</span>
              {ai.rewrites.map((r, i) => (
                <p key={i} lang={task.lang} className="rounded-control-sm px-3 py-2.5 text-sm leading-normal text-fg-secondary inset-ring-1 inset-ring-line">
                  {r.was} → <b className="font-semibold text-fg">{r.better}</b>
                </p>
              ))}
            </div>
          )}
        </PanelCard>
      ) : null}
      <PanelCard title="Твоя проверка" mine>
        <div className="flex flex-col gap-1.5">
          <p className="flex justify-between px-1 text-note font-medium text-fg-muted">
            <span>Итоговый {kindWord}</span>
            {aiBand && <span>AI: {aiBand}</span>}
          </p>
          <BandPicker label={`Итоговый ${kindWord}`} options={bandChoices(task.mode, aiBand, band)} value={band} onChange={setBand} />
        </div>
        <label className="flex flex-col gap-1">
          <small className="text-xs text-fg-muted">Комментарий {who}</small>
          <textarea
            className="field-sizing-content min-h-18 w-full resize-none rounded-control-sm bg-surface px-3 py-2.5 text-sm leading-relaxed text-fg inset-ring-1 inset-ring-line outline-none placeholder:text-fg-muted focus:inset-ring-2 focus:inset-ring-focus"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что удалось, над чем поработать…"
          />
        </label>
        {draft.restored && <DraftRestored onClear={draft.clear} />}
        {error && <p className="text-sm text-danger-strong">{error}</p>}
      </PanelCard>
      {assignment.attempts && assignment.attempts.length > 0 && (
        <PanelCard title="История">
          <WritingHistory attempts={assignment.attempts} />
        </PanelCard>
      )}
      {/* закреплены у низа окна (d7-3: «край окна — кнопки здесь»), на телефоне — над навигацией */}
      <div style={{ bottom: `calc(${bottom} + 1rem)` }} className="@container sticky z-10 rounded-card bg-surface px-4.5 py-3.5 shadow-raised">
        {/* уже 384 — друг под другом: рядом «Завершить проверку» ломалась на две строки */}
        <div className="flex flex-col gap-2.5 @sm:flex-row">
          <Button className="flex-1" onClick={finish} loading={busy === 'finish'} disabled={busy !== null}>
            {reviewed ? 'Обновить проверку' : 'Завершить проверку'}
          </Button>
          <Button variant="outline" onClick={reassign} loading={busy === 'reassign'} disabled={busy !== null}>
            На доработку
          </Button>
        </div>
      </div>
    </>
  )

  return (
    <div ref={root} className="flex flex-col gap-4">
      <ScreenTop
        back={{ label: backLabel, onClick: onBack }}
        title={`${studentName} · ${writingKind(task)}`}
        subtitle={['письмо', whenDone(assignment.submitted_at)].filter(Boolean).join(' · ')}
        trailing={pager}
      />
      <TextPanel
        label="Проверка письма"
        text={<EssayCard task={task} essay={essay} meta={meta} marks={marks} number={number} kept={kept} selected={selected} onSelect={(i) => select(i, 'text')} />}
        panel={panel}
      />
      {dialog}
    </div>
  )
}

function TextList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-note font-semibold text-fg-muted">{title}</span>
      <ul className="list-disc pl-4.5 text-sm leading-normal text-fg-secondary">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  )
}
