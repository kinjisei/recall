// ============================================================================
// «Новое письмо» (макет d9-2, PLAN.md Ф2.17-4в-3): на компьютере — панель 440
// справа поверх списка, на телефоне — шторка снизу (shared/ui/Sheet). Режим
// IELTS / обычное эссе; IELTS — тип плитками с объёмом и временем, целевой
// балл, вопрос («✦ Придумать вопрос» — AI; придуманный помечен «придумал AI ·
// можно править»), у Academic Task 1 — график; эссе — язык, уровень, слова,
// грамматика, минимум слов. Форма — черновик до создания (Ф1.14).
// ============================================================================
import { useState } from 'react'
import { createWritingTask, generateChartTask, generateIeltsQuestion } from '../../../lib/writing'
import type { ChartSpec, WritingSettings, WritingTask } from '../../../types'
import { Button } from '../../../shared/ui/Button'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { SHEET_BODY, Sheet, SheetFooter } from '../../../shared/ui/Sheet'
import { SheetHeader } from '../../../shared/ui/SheetHeader'
import { useSheetClose } from '../../../shared/ui/sheetClose'
import { fieldClass } from '../../../shared/ui/TextField'
import { IconArrowRight, IconChart, IconSparkle } from '../../../shared/ui/icons'
import { ChartView } from '../../../components/ChartView'
import { BandPicker } from '../../writing'
import { FORM_HINTS } from '../formHints'
import { LEVELS } from '../materials/shared'
import { FieldLabel } from '../materials/wizardBits'
import { useWritingTaskDraft } from '../useWritingTaskDraft'
import { ieltsHint } from './writingFacts'
import { ErrorText } from '../../../shared/ui/ErrorText'

const CHART_KINDS: { id: ChartSpec['kind']; label: string }[] = [
  { id: 'bar', label: 'Столбцы' },
  { id: 'line', label: 'Линия' },
  { id: 'pie', label: 'Круговая' },
  { id: 'table', label: 'Таблица' },
]
const BANDS = ['5.5', '6.0', '6.5', '7.0', '7.5', '8.0']
const split = (s: string) => s.split(',').map((w) => w.trim()).filter(Boolean)

export function NewWritingPanel({ onClose, onCreated }: { onClose: () => void; onCreated: (task: WritingTask) => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="new-writing" maxH="92dvh">
      <SheetHeader id="new-writing" title="Новое письмо" />
      <Form onCreated={onCreated} />
    </Sheet>
  )
}

function Form({ onCreated }: { onCreated: (task: WritingTask) => void }) {
  const w = useWritingTaskDraft()
  const { mode, setMode, lang, setLang, level, setLevel, ieltsTask, setIeltsTask, targetBand, setTargetBand } = w
  const { chartKind, setChartKind, chartTopic, setChartTopic, chart, setChart, prompt, setPrompt, aiPrompt, setAiPrompt } = w
  const { targetWords, setTargetWords, targetGrammar, setTargetGrammar, minWords, setMinWords, draft } = w
  const close = useSheetClose()
  const [busy, setBusy] = useState<'gen' | 'chart' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ielts = mode === 'ielts'

  const run = async (kind: 'gen' | 'chart', job: () => Promise<void>, fail: string) => {
    setBusy(kind)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : fail)
    } finally {
      setBusy(null)
    }
  }
  const genQuestion = () =>
    run('gen', async () => {
      const q = await generateIeltsQuestion(ieltsTask === 'gt1' ? 'gt1' : 'task2')
      setPrompt(q)
      setAiPrompt(q)
    }, 'Ошибка генерации вопроса')
  const genChart = () =>
    run('chart', async () => {
      const { prompt: p, chart: ch } = await generateChartTask(chartKind, chartTopic)
      setChart(ch)
      setPrompt(p)
      setAiPrompt(p)
    }, 'Ошибка генерации графика')

  const save = async () => {
    if (!prompt.trim() || busy) return
    setBusy('save')
    setError(null)
    const settings: WritingSettings = ielts
      ? { ieltsTask, targetBand: Number(targetBand), ...(ieltsTask === 'academic1' && chart ? { chart } : {}) }
      : { targetWords: split(targetWords), targetGrammar: split(targetGrammar), minWords: Number(minWords) || 0 }
    try {
      const task = await createWritingTask({ lang: ielts ? 'en' : lang, mode, level, prompt: prompt.trim(), settings })
      draft.forget()
      onCreated(task)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать')
      setBusy(null)
    }
  }
  // «Отмена» выбрасывает черновик; «×» и Esc закрывают, а набранное остаётся
  const cancel = () => {
    draft.clear()
    close?.()
  }
  const byAi = !!aiPrompt && prompt === aiPrompt

  return (
    <>
      <div className={SHEET_BODY}>
        {draft.restored && <DraftRestored onClear={draft.clear} />}
        <div>
          <FieldLabel>Режим</FieldLabel>
          <ChoiceGroup variant="segment" label="Режим" value={mode} onChange={setMode} options={[{ id: 'ielts', label: 'IELTS' }, { id: 'regular', label: 'Обычное эссе' }]} />
        </div>
        {ielts ? (
          <>
            <div>
              <FieldLabel>Тип</FieldLabel>
              <ChoiceGroup
                variant="tiles"
                label="Тип"
                value={ieltsTask}
                onChange={setIeltsTask}
                options={[
                  { id: 'task2', label: 'Task 2', hint: ieltsHint('task2') },
                  { id: 'gt1', label: 'GT Task 1', hint: ieltsHint('gt1') },
                  { id: 'academic1', label: 'Academic Task 1', hint: ieltsHint('academic1') },
                ]}
              />
            </div>
            <div>
              <FieldLabel>Целевой балл</FieldLabel>
              <BandPicker label="Целевой балл" options={BANDS} value={targetBand} onChange={setTargetBand} />
            </div>
            {ieltsTask === 'academic1' && (
              <div className="flex flex-col gap-2.5">
                <FieldLabel>График</FieldLabel>
                <ChoiceGroup label="Тип графика" value={chartKind} onChange={setChartKind} options={CHART_KINDS} />
                <input className={fieldClass()} placeholder="Тема данных (необязательно): население, продажи…" value={chartTopic} onChange={(e) => setChartTopic(e.target.value)} />
                <Button size="sm" variant="outline" className="self-start" onClick={() => void genChart()} loading={busy === 'chart'} disabled={busy !== null}>
                  <IconChart size={16} aria-hidden /> Сгенерировать график
                </Button>
                {chart && (
                  <div className="rounded-control border border-line p-3">
                    <ChartView chart={chart} />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <FieldLabel>Язык</FieldLabel>
              <ChoiceGroup variant="segment" label="Язык" value={lang} onChange={setLang} options={[{ id: 'en', label: 'Английский' }, { id: 'es', label: 'Испанский' }]} />
            </div>
            <div>
              <FieldLabel>Уровень ученика</FieldLabel>
              <ChoiceGroup variant="segment" label="Уровень ученика" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ id: l, label: l }))} />
            </div>
          </>
        )}
        <div>
          <FieldLabel
            aside={
              byAi && (
                <span className="inline-flex items-center gap-1 font-medium text-accent-strong">
                  <IconSparkle size={14} aria-hidden /> придумал AI · можно править
                </span>
              )
            }
          >
            {ielts ? 'Вопрос задания' : 'Тема / задание'}
          </FieldLabel>
          <textarea
            lang={ielts ? 'en' : lang}
            aria-label={ielts ? 'Вопрос задания' : 'Тема / задание'}
            className={`${fieldClass()} field-sizing-content min-h-30 py-3`}
            placeholder={ielts ? 'Вставь или сгенерируй вопрос IELTS…' : 'Например: Напиши письмо другу о своём последнем путешествии.'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {ielts && ieltsTask !== 'academic1' && (
            <Button size="sm" variant="outline" className="mt-2.5" onClick={() => void genQuestion()} loading={busy === 'gen'} disabled={busy !== null}>
              <IconSparkle size={16} aria-hidden /> Придумать вопрос
            </Button>
          )}
        </div>
        {!ielts && (
          <>
            <label className="block">
              <FieldLabel opt>Целевые слова через запятую</FieldLabel>
              <input lang={lang} className={fieldClass()} placeholder={FORM_HINTS[lang].essayWords} value={targetWords} onChange={(e) => setTargetWords(e.target.value)} />
            </label>
            <label className="block">
              <FieldLabel opt>Целевая грамматика через запятую</FieldLabel>
              <input lang={lang} className={fieldClass()} placeholder={FORM_HINTS[lang].essayGrammar} value={targetGrammar} onChange={(e) => setTargetGrammar(e.target.value)} />
            </label>
            <label className="block">
              <FieldLabel opt>Минимум слов</FieldLabel>
              <input className={fieldClass()} inputMode="numeric" placeholder="150" value={minWords} onChange={(e) => setMinWords(e.target.value.replace(/\D/g, ''))} />
            </label>
          </>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <SheetFooter>
        <div className="flex gap-2.5">
          <Button className="flex-1" onClick={() => void save()} loading={busy === 'save'} disabled={busy !== null || !prompt.trim()}>
            Создать <IconArrowRight size={18} aria-hidden />
          </Button>
          <Button variant="outline" onClick={cancel} disabled={busy !== null}>
            Отмена
          </Button>
        </div>
      </SheetFooter>
    </>
  )
}
