// ============================================================================
// Форма нового письменного задания переживает перезагрузку, пока задание не
// создано (PLAN.md Ф1.14): режим, уровень, вопрос (его мог придумать AI),
// график, слова и грамматика — одним черновиком (shared/lib/useDraft).
// ============================================================================
import { useDraftForm } from '../../shared/lib/useDraft'
import type { AppLang, CEFRLevel, ChartSpec, WritingMode } from '../../types'

/** Черновик формы — его ищет и список: есть черновик — открыть сразу форму. */
export const WRITING_TASK_DRAFT = 'writing-task'

export function useWritingTaskDraft() {
  const [form, field, draft] = useDraftForm(WRITING_TASK_DRAFT, {
    mode: 'ielts' as WritingMode,
    lang: 'en' as AppLang,
    level: 'B1' as CEFRLevel,
    ieltsTask: 'task2' as 'task2' | 'gt1' | 'academic1',
    targetBand: '6.5',
    chartKind: 'bar' as ChartSpec['kind'],
    chartTopic: '',
    chart: null as ChartSpec | null,
    prompt: '',
    targetWords: '',
    targetGrammar: '',
    minWords: '150',
  })
  return {
    ...form,
    setMode: field('mode'),
    setLang: field('lang'),
    setLevel: field('level'),
    setIeltsTask: field('ieltsTask'),
    setTargetBand: field('targetBand'),
    setChartKind: field('chartKind'),
    setChartTopic: field('chartTopic'),
    setChart: field('chart'),
    setPrompt: field('prompt'),
    setTargetWords: field('targetWords'),
    setTargetGrammar: field('targetGrammar'),
    setMinWords: field('minWords'),
    draft,
  }
}
