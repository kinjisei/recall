// ============================================================================
// Новая программа и черновик AI (макеты d11-2, d11-3).
//
// Форма — карточка «Новая программа»: язык и уровень полосами, «Недель» −/+,
// «Цель или пожелания», под ними — что учтёт AI; внизу раздела «Черновик можно
// будет поправить до сохранения» и «✦ Составить программу».
// Черновик отличается тремя признаками (легенда d11-3): жёлтая плашка
// «Черновик AI · ещё не назначен — Айгерим его не видит», пунктирная рамка
// вокруг недель и закреплённые снизу «К форме · Составить заново · Сохранить
// и назначить». Правки к черновику — через «К форме» в «Цель или пожелания»:
// AI получает их тем же текстом, что раньше отдельное поле «Правки».
// План дня (daily) стоит под формой и под черновиком — над подвалом.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { generateStudyPlan, saveStudyPlan, type PlanRequest } from '../../../lib/studyPlan'
import { useDraftForm } from '../../../shared/lib/useDraft'
import { Button } from '../../../shared/ui/Button'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { IconBack, IconRefresh, IconSparkle } from '../../../shared/ui/icons'
import { NumberStepper } from '../../../shared/ui/NumberStepper'
import { Field, fieldClass } from '../../../shared/ui/TextField'
import type { AppLang } from '../../../types'
import { PlanView } from '../../program'
import { SectionCard, SectionFooter } from '../sectionBits'
import { initialProgramForm, programDraftKey, type ProgramForm as Form } from './programDraft'
import { ErrorText } from '../../../shared/ui/ErrorText'

const LANGS: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
]
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => ({ id: l, label: l }))

export function ProgramForm({
  studentId,
  name,
  base,
  activeLangs,
  onCancel,
  onRemove,
  onSaved,
  daily,
}: {
  studentId: string
  /** Имя ученика — «Айгерим его не видит». */
  name: string
  /** Язык, уровень, недели и цель новой формы: из сохранённой программы («Изменить») или умолчания. */
  base: Pick<Form, 'lang' | 'level' | 'weeks' | 'goal'>
  /** Языки сохранённых программ: новая на том же языке заменит прежнюю (спросим). */
  activeLangs: AppLang[]
  /** Назад к сохранённой программе. */
  onCancel?: () => void
  /** «Снять программу» — только при «Изменить». */
  onRemove?: () => void
  onSaved: (lang: AppLang) => void
  daily: ReactNode
}) {
  const [initial] = useState(() => initialProgramForm(studentId, base))
  const [form, field, draft] = useDraftForm<Form>(programDraftKey(studentId), initial)
  const { lang, level, weeks, goal, preview, editing } = form
  const [busy, setBusy] = useState<'gen' | 'save' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()
  const req: PlanRequest = { studentId, lang, level, weeks, goal }

  const generate = async () => {
    setBusy('gen')
    setErr(null)
    try {
      field('preview')(await generateStudyPlan(req))
      field('editing')(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось составить программу')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!preview) return
    if (activeLangs.includes(lang) && !(await confirm({ title: 'Заменить программу?', body: 'Прошлая программа уйдёт в архив — ученик будет видеть новую.', action: 'Сохранить новую', danger: false })))
      return
    setBusy('save')
    setErr(null)
    try {
      await saveStudyPlan(req, preview)
      draft.forget()
      onSaved(lang)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
    }
  }

  const showDraft = preview && !editing
  const error = err && (
    <ErrorText className="px-1">
      {err}
    </ErrorText>
  )

  return (
    <>
      {draft.restored && <DraftRestored onClear={draft.clear} className="px-1" />}
      {showDraft ? (
        <>
          <p className="flex items-center gap-2.5 rounded-control-sm bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning-soft-fg" data-program-draft>
            <IconSparkle size={18} aria-hidden className="flex-none" />
            <span>
              <b className="font-bold">Черновик AI</b> · ещё не назначен — {name} его не видит
            </span>
          </p>
          <div className="border-dashed-warning flex flex-col gap-3 rounded-row p-3.5">
            {preview.summary && <p className="text-body text-fg">{preview.summary}</p>}
            <PlanView weeks={preview.weeks} />
          </div>
        </>
      ) : (
        <SectionCard
          title={onRemove ? 'Изменить программу' : 'Новая программа'}
          className="gap-4.5"
          action={
            onRemove && (
              <Button variant="danger-outline" onClick={onRemove}>
                Снять программу
              </Button>
            )
          }
        >
          <div className="flex flex-wrap gap-4.5">
            <Field label="Язык">
              <ChoiceGroup variant="segment" label="Язык программы" options={LANGS} value={lang} onChange={field('lang')} />
            </Field>
            <Field label="Уровень">
              <ChoiceGroup variant="segment" label="Уровень ученика" options={LEVELS} value={level} onChange={field('level')} />
            </Field>
          </div>
          <Field label="Недель">
            <NumberStepper label="Недель" value={weeks} min={2} max={8} onChange={field('weeks')} />
          </Field>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-secondary">
              Цель или пожелания <span className="font-normal text-fg-muted">· необязательно</span>
            </span>
            <textarea
              value={goal}
              onChange={(e) => field('goal')(e.target.value)}
              rows={3}
              placeholder="Например: подготовка к поездке, упор на разговорную речь…"
              className={`${fieldClass()} min-h-24 py-3`}
            />
          </label>
          <p className="flex gap-2.5 rounded-control bg-accent-soft px-4 py-3.5 text-body text-accent-soft-fg">
            <IconSparkle size={18} aria-hidden className="mt-0.5 flex-none" />
            AI учтёт диагностику ученика: слабые темы грамматики, буксующие слова и баллы по заданиям
          </p>
        </SectionCard>
      )}
      {error}
      {daily}

      {showDraft ? (
        <SectionFooter
          text={
            <Button variant="ghost" className="-ml-2 px-2" disabled={!!busy} onClick={() => field('editing')(true)}>
              <IconBack size={18} aria-hidden /> К форме
            </Button>
          }
        >
          <Button variant="outline" size="md" loading={busy === 'gen'} disabled={busy === 'save'} onClick={() => void generate()}>
            <IconRefresh size={18} aria-hidden /> Составить заново
          </Button>
          <Button size="md" loading={busy === 'save'} disabled={busy === 'gen'} onClick={() => void save()}>
            Сохранить и назначить
          </Button>
        </SectionFooter>
      ) : (
        <SectionFooter
          text={
            preview || onCancel ? (
              <span className="-ml-2 flex flex-wrap">
                {/* «К программе» черновик не выбрасывает: «Изменить» вернёт к нему */}
                {onCancel && (
                  <Button variant="ghost" className="px-2" onClick={onCancel}>
                    <IconBack size={18} aria-hidden /> К программе
                  </Button>
                )}
                {preview && (
                  <Button variant="ghost" className="px-2" onClick={() => field('editing')(false)}>
                    {onCancel ? '' : <IconBack size={18} aria-hidden />} К черновику
                  </Button>
                )}
              </span>
            ) : (
              'Черновик можно будет поправить до сохранения'
            )
          }
        >
          <Button size="md" loading={busy === 'gen'} onClick={() => void generate()}>
            {busy === 'gen' ? (
              'Составляю (до минуты)…'
            ) : (
              <>
                <IconSparkle size={18} aria-hidden /> {preview ? 'Составить заново' : 'Составить программу'}
              </>
            )}
          </Button>
        </SectionFooter>
      )}
      {dialog}
    </>
  )
}
