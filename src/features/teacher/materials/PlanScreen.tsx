// ============================================================================
// Шаг 2 мастера: план от AI (макет d8-3, PLAN.md Ф2.17-4в-2б). Слева — что
// задумал AI, целевые слова чипами (со звёздочкой — добавил AI; убрать и
// дописать можно без генерации), упражнения, правки и «↻ Пересоставить план».
// Справа «Итог» и «Новый текст →». Пока AI пишет текст — скелетон шага
// «Текст» (d8-5); «План» в шагах возвращает к плану, текст тогда ляжет
// готовым шагом впереди («Вернуться к готовому тексту»).
//
// Пересоставить план бесплатно 3 раза за оплаченный план (журнал п.76 (7)):
// право выдаёт сервер вместе с планом (grant), считает и проверяет он же
// (api/_replan.ts, миграция 0014). Права нет или кончилось — повтор за
// генерацию, и с ним новое право.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { fieldClass } from '../../../shared/ui/TextField'
import { IconRefresh, IconSparkle } from '../../../shared/ui/icons'
import { MainAside } from '../../../shared/ui/layouts'
import { AppError } from '../../../shared/api/errors'
import type { ReplanGrant } from '../../../shared/api/ai'
import { plural } from '../../../shared/lib/plural'
import { useDraft } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { audienceOf, generateMaterialContent, generateMaterialPlan, type MaterialContent, type MaterialRequest } from '../../../lib/materials'
import type { MaterialPlan } from '../../../types'
import { levelSummary } from './audience'
import type { StudentLevels } from './useStudentLevels'
import { FieldLabel, FormCard, Summary, WizardTop, audienceItems, gensAfter, materialLine } from './wizardBits'
import { WordChips, splitWords } from './WordChips'
import { TextSkeleton, WritingAside } from './textBits'
import { ErrorText } from '../../../shared/ui/ErrorText'

const KIND: Record<string, string> = { comprehension: 'Понимание текста', grammar: 'Грамматика', vocab: 'Словарь' }
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function PlanScreen({
  req,
  plan,
  grant,
  levels,
  gens,
  onBack,
  onForward,
  onExit,
  onEdited,
  onReplanned,
  onGenerated,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  /** Право на бесплатные повторы этого плана (выдал сервер); нет — повтор за генерацию. */
  grant?: ReplanGrant
  levels: StudentLevels
  gens: { left: number; limit: number } | null
  onBack: () => void
  /** Текст по плану уже готов (вернулись из него) — к нему без новой генерации. */
  onForward?: () => void
  /** «‹ Материалы»: выйти из мастера (с вопросом — план стоил генерации). */
  onExit: () => void
  /** Слова поправлены руками — без генерации; свои слова уходят и в заявку. */
  onEdited: (req: MaterialRequest, plan: MaterialPlan) => void
  onReplanned: (plan: MaterialPlan, grant?: ReplanGrant) => void
  /** Текст готов; stay — учитель вернулся к плану, пока AI писал: текст — шагом впереди. */
  onGenerated: (content: MaterialContent, stay: boolean) => void
}) {
  // правки переживают перезагрузку; текст по ним составлен — стираются (Ф1.14)
  const [feedback, setFeedback, draft] = useDraft('material-plan-feedback', '')
  const [busy, setBusy] = useState<'replan' | 'generate' | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()
  // ответ AI приходит позже: смотрим, где учитель сейчас, а не где был при нажатии
  const writingNow = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    writingNow.current = writing
  }, [writing])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const exit = async () => {
    const text = busy === 'generate' ? 'AI ещё пишет текст — генерация всё равно спишется.' : 'План, который составил AI, пропадёт.'
    if (await confirm({ title: 'Выбросить материал?', body: text, action: 'Выбросить', cancel: 'Оставить' })) onExit()
  }

  const freeLeft = grant?.left ?? 0
  const replan = async () => {
    setBusy('replan')
    setError(null)
    const free = grant && freeLeft > 0 ? grant : undefined
    try {
      let fresh: ReplanGrant | undefined
      const next = await generateMaterialPlan(req, feedback.trim() || undefined, { replan: free?.id, onReplan: (g) => (fresh = g) })
      onReplanned(next, fresh ?? free)
      setFeedback('')
    } catch (e) {
      // повторы кончились (или право устарело) — дальше честно за генерацию
      if (e instanceof AppError && e.code === 'RECALL_REPLAN_LIMIT' && grant) onReplanned(plan, { ...grant, left: 0 })
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    setBusy('generate')
    setWriting(true)
    setError(null)
    try {
      const content = await generateMaterialContent(req, plan, feedback.trim() || undefined)
      if (!alive.current) return
      draft.forget()
      onGenerated(content, !writingNow.current)
    } catch (e) {
      if (!alive.current) return
      setWriting(false)
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      if (alive.current) setBusy(null)
    }
  }

  const reqWords = splitWords(req.vocabulary)
  const setWords = (words: string[]) => {
    const added = words.filter((w) => !plan.vocabulary.some((x) => same(x, w)))
    const removed = plan.vocabulary.filter((w) => !words.some((x) => same(x, w)))
    const vocabulary = [...reqWords.filter((w) => !removed.some((r) => same(r, w))), ...added].join(', ')
    onEdited({ ...req, vocabulary }, { ...plan, vocabulary: words })
  }
  const ids = audienceOf(req)
  const exTotal = plan.exercise_plan.reduce((n, p) => n + (p.count || 0), 0)
  const generating = busy === 'generate'
  const top = (
    <WizardTop
      current={writing ? 'text' : 'plan'}
      // пока AI пишет, к заявке не уходим: текст лёг бы не к этому плану
      go={{ form: generating ? null : onBack, plan: writing ? () => setWriting(false) : null, text: generating && !writing ? () => setWriting(true) : (onForward ?? null) }}
      onExit={() => void exit()}
    />
  )

  if (writing) {
    return (
      <div className="flex flex-col gap-4">
        {top}
        <MainAside size="work" label="Сохранение" main={<TextSkeleton req={req} exercises={exTotal} />} aside={<WritingAside ids={ids} req={req} levels={levels} />} />
        {dialog}
      </div>
    )
  }

  const words = plan.vocabulary.length
  const aside = (
    <Summary
      items={[
        ...audienceItems(ids.map(levels.nameOf), req.level, levels.known(req.lang) ? levelSummary(levels.picked(ids, req.lang), req.level) : undefined),
        {
          label: 'Что получится',
          value: materialLine(req.format, req.lengthRange, req.lang),
          note: `${words} ${plural(words, 'целевое слово', 'целевых слова', 'целевых слов')} · ${exTotal} ${plural(exTotal, 'упражнение', 'упражнения', 'упражнений')}`,
        },
      ]}
      gen={
        <>
          {freeLeft > 0 ? (
            <>Пересоставить план — бесплатно{freeLeft === 1 && ', последний раз'}</>
          ) : (
            <>
              Пересоставить план — <b className="font-semibold text-fg">1 генерация</b>
            </>
          )}
          <br />
          Текст спишет <b className="font-semibold text-fg">1 генерацию</b>
          {gens && ` · ${gensAfter(gens, 1)}`}
        </>
      }
    >
      {error && <ErrorText>{error}</ErrorText>}
      <Button className="w-full" onClick={() => void generate()} loading={generating} disabled={busy !== null}>
        Новый текст →
      </Button>
      {onForward && (
        <Button variant="secondary" className="w-full" onClick={onForward} disabled={busy !== null}>
          Вернуться к готовому тексту →
        </Button>
      )}
    </Summary>
  )

  const main = (
    <FormCard label="План от AI">
      <h2 className="text-lg font-semibold">План от AI</h2>
      <p className="-mt-1.5 flex gap-2.5 rounded-control bg-accent-soft px-4 py-3.5 text-body leading-normal text-accent-soft-fg">
        <IconSparkle size={16} aria-hidden className="mt-0.5 flex-none" />
        <span className="whitespace-pre-wrap">{plan.comments}</span>
      </p>
      <div data-plan-words>
        <FieldLabel aside={<span className="font-normal">со звёздочкой — добавил AI</span>}>Целевые слова · {words}</FieldLabel>
        <WordChips
          lang={req.lang}
          words={plan.vocabulary}
          onChange={setWords}
          ai={(w) => !reqWords.some((x) => same(x, w))}
          placeholder="Слово"
          inputLabel="Своё слово в план"
          add
          disabled={busy !== null}
        />
      </div>
      <div>
        <FieldLabel>Упражнения · {exTotal}</FieldLabel>
        <div className="flex flex-col gap-2">
          {plan.exercise_plan.map((p, i) => (
            <div key={i} className="flex items-start gap-3 rounded-control-sm bg-input px-3.5 py-3">
              <span className="flex h-7 min-w-8 flex-none items-center justify-center rounded-tag bg-surface px-2 text-sm font-bold text-fg tabular-nums">{p.count}</span>
              <span className="flex flex-col gap-0.5 text-sm leading-snug text-fg-secondary">
                <b className="text-body font-semibold text-fg">{KIND[p.kind] ?? p.kind}</b>
                {p.note}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block">
          <FieldLabel opt>Правки к плану</FieldLabel>
          <textarea
            className={`${fieldClass()} field-sizing-content min-h-19 py-3`}
            placeholder="Например: добавь короткий диалог у стойки"
            value={feedback}
            disabled={busy !== null}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
        {draft.restored && <DraftRestored onClear={draft.clear} className="mt-2" />}
      </div>
      <div className="-mt-2">
        <Button variant="outline" size="sm" onClick={() => void replan()} loading={busy === 'replan'} disabled={busy !== null}>
          <IconRefresh size={16} aria-hidden /> Пересоставить план
        </Button>
      </div>
    </FormCard>
  )

  return (
    <div className="flex flex-col gap-4">
      {top}
      <MainAside size="work" label="Итог" main={main} aside={aside} />
      {dialog}
    </div>
  )
}
