// ============================================================================
// Шаг 3 мастера: текст готов (макет d8-4, PLAN.md Ф2.17-4в-2б). Слева статья
// с подсвеченными словами плана и упражнения с ответами; справа правки к
// тексту и «Назначится при сохранении»: кто, с уровнем, «Сохранить и выдать
// двоим», «↻ Перегенерировать» и сколько это стоит. «Сохранить» сразу
// назначает тем, для кого материал (Ф2.11б-3). «Мой текст» — без плана:
// перегенерируются только упражнения, текст остаётся. AI сделал меньше, чем
// выбрал учитель (Ф2.25-2), — над упражнениями сказано, чего и сколько не
// хватает: молча меньше учитель не получает. Упражнения правятся руками
// (d17, Ф2.25-3): «Изменить · Убрать», «+ Упражнение → Напишу сам»; правка
// меняет этот шаг (черновик мастера), открытая форма — свой черновик.
// ============================================================================
import { useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { IconRefresh } from '../../../shared/ui/icons'
import { MainAside } from '../../../shared/ui/layouts'
import { useDraft } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import {
  assignMaterial,
  audienceOf,
  generateExercisesForText,
  generateMaterialContent,
  saveMaterial,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import type { Material, MaterialPlan } from '../../../types'
import type { StudentLevels } from './useStudentLevels'
import { Hint, WizardTop } from './wizardBits'
import { planShortfall } from '../../../lib/exerciseFormats'
import { clearDraft } from '../../../shared/lib/drafts'
import { EXERCISE_EDIT_DRAFT, ExerciseList } from './edit/ExerciseList'
import { Article, AssignCard, ExercisesCard, TextFeedback, assignRows, saveLabel } from './textBits'
import { ErrorText } from '../../../shared/ui/ErrorText'

export function PreviewScreen({
  req,
  plan,
  content,
  own = false,
  edited = false,
  levels,
  gens,
  onBack,
  onToForm,
  onExit,
  onRegenerated,
  onEdited,
  onSaved,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  content: MaterialContent
  /** «Мой текст»: перегенерируем ТОЛЬКО упражнения, тело сохраняем. */
  own?: boolean
  /** Учитель правил упражнения руками: «AI сделал не всё» уже не к месту. */
  edited?: boolean
  levels: StudentLevels
  gens: { left: number; limit: number } | null
  /** Шаг назад: к плану (у «Моего текста» — к заявке). */
  onBack: () => void
  /** «Заявка» в шагах — через план, ничего не выбрасывая. */
  onToForm: () => void
  /** «‹ Материалы»: выйти из мастера (с вопросом — текст стоил генерации). */
  onExit: () => void
  onRegenerated: (content: MaterialContent) => void
  /** Упражнения поправлены руками (d17). */
  onEdited: (content: MaterialContent) => void
  /** notice — кому назначить не вышло (материал при этом сохранён). */
  onSaved: (material: Material, notice?: string) => void
}) {
  const ids = audienceOf(req)
  // правки переживают перезагрузку; ушёл с экрана — стираются (Ф1.14)
  const [feedback, setFeedback, draft] = useDraft('material-preview-feedback', '')
  const [busy, setBusy] = useState<'regen' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // упражнение на правке без «Готово»: сохранение спросит, а не потеряет правку молча
  const [pending, setPending] = useState<number | null>(null)
  const { confirm, dialog } = useConfirm()
  const leave = (to: () => void) => () => {
    draft.forget()
    clearDraft(EXERCISE_EDIT_DRAFT)
    to()
  }
  const exit = async () => {
    if (await confirm({ title: 'Выбросить материал?', body: 'Текст и упражнения, которые составил AI, пропадут.', action: 'Выбросить', cancel: 'Оставить' })) leave(onExit)()
  }

  const regen = async () => {
    setBusy('regen')
    setError(null)
    try {
      const fb = feedback.trim() || undefined
      const next = own
        ? await generateExercisesForText(content.body, req.lang, req.level, { vocabulary: req.vocabulary, grammar: req.grammar, feedback: fb, rows: plan.exercise_plan })
        : await generateMaterialContent(req, plan, fb)
      clearDraft(EXERCISE_EDIT_DRAFT)
      onRegenerated(next)
      setFeedback('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (
      pending !== null &&
      !(await confirm({
        title: `Упражнение ${pending} ещё на правке`,
        body: 'Сохранить материал без этой правки? Чтобы её оставить, нажми «Готово» в упражнении.',
        action: 'Сохранить без правки',
        cancel: 'Вернуться к правке',
      }))
    ) {
      return
    }
    setBusy('save')
    setError(null)
    let material: Material
    try {
      material = await saveMaterial(req, plan, content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
      return
    }
    // «Для кого» — это же назначение: тем же RPC, что кнопка «Назначить» (права
    // и связь с учеником проверяет база). Не вышло у кого-то — материал всё
    // равно сохранён, назначить можно в его карточке; второй экземпляр не нужен.
    const settled = await Promise.allSettled(ids.map((id) => assignMaterial(material.id, id)))
    const failed = ids.filter((_, i) => settled[i]?.status === 'rejected').map(levels.nameOf)
    draft.forget()
    clearDraft(EXERCISE_EDIT_DRAFT)
    onSaved(material, failed.length ? `Не назначено: ${failed.join(', ')} — назначь ниже ещё раз.` : undefined)
  }

  const short = edited ? [] : planShortfall(plan.exercise_plan, content.exercises, req.level)
  const main = (
    <div className="flex flex-col gap-3.5">
      <Article req={req} title={content.title} body={content.body} words={plan.vocabulary} />
      <ExercisesCard exercises={content.exercises}>
        {short.length > 0 && (
          <div className="-mx-1 -mt-2 mb-1" data-shortfall>
            <Hint warn>
              AI сделал не всё, что выбрано в плане, — перегенерируй или сохрани как есть: {short.map((x) => `${x.label} — ${x.got} из ${x.want} ${x.unit}`).join('; ')}
            </Hint>
          </div>
        )}
        <ExerciseList
          exercises={content.exercises}
          onChange={(exercises) => onEdited({ ...content, exercises })}
          text={{ body: content.body, lang: req.lang, level: req.level }}
          draftScope={EXERCISE_EDIT_DRAFT}
          disabled={busy !== null}
          onPending={setPending}
        />
      </ExercisesCard>
    </div>
  )
  const aside = (
    <>
      <TextFeedback value={feedback} onChange={setFeedback} disabled={busy !== null} lang={req.lang} />
      {draft.restored && <DraftRestored onClear={draft.clear} className="-mt-1.5 px-1" />}
      <AssignCard
        rows={assignRows(ids, req.lang, levels)}
        info={
          <>
            {own ? 'Перегенерировать упражнения' : 'Перегенерировать весь текст'} — <b className="font-semibold text-fg">1 генерация</b>
            {gens && ` · Генерации материалов: ${gens.left} из ${gens.limit} в месяц`}
          </>
        }
      >
        {error && <ErrorText>{error}</ErrorText>}
        <Button className="w-full" onClick={() => void save()} loading={busy === 'save'} disabled={busy !== null}>
          {saveLabel(ids.length)}
        </Button>
        <Button variant="outline" size="sm" className="w-full" onClick={() => void regen()} loading={busy === 'regen'} disabled={busy !== null}>
          <IconRefresh size={16} aria-hidden /> {own ? 'Перегенерировать упражнения' : 'Перегенерировать всё'}
        </Button>
      </AssignCard>
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <WizardTop
        current="text"
        own={own}
        // пока сохраняем или пишем заново — с шага не уходим: ответ лёг бы мимо
        go={busy ? {} : { form: leave(own ? onBack : onToForm), plan: own ? null : leave(onBack) }}
        onExit={() => void exit()}
      />
      <MainAside size="work" label="Сохранение" main={main} aside={aside} />
      {dialog}
    </div>
  )
}
