// ============================================================================
// Шаги «Начать занятие» на «Моей учёбе» (журнал п.76 (10)): план дня этого
// человека (его преподаватель мог его настроить), задания и квесты, сколько
// слов к повторению — и что сегодня уже сделано. Главная берёт те же входы
// из своего первого кадра (useHomeData) и считает шаги той же функцией
// `sessionSteps`.
//
// Не пришло — план без настроек учителя: занятие всё равно начнётся, просто
// по умолчанию (не говорим «план 0» и не прячем кнопку).
// ============================================================================
import { buildTodayPlan, getMyDailyPlanConfig, sessionSteps, type TodayPlanItem } from '../../lib/dailyPlan'
import { countDueCards } from '../../lib/fsrs'
import { listMyQuests } from '../../lib/quests'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import type { ActivityType, AppLang } from '../../types'
import { loadAssignmentCounts } from '../teacher'

async function loadInputs(lang: AppLang) {
  const [cfg, counts, quests, due] = await Promise.all([getMyDailyPlanConfig(), loadAssignmentCounts(), listMyQuests(), countDueCards(lang)])
  return { cfg, pending: counts.pending, quests: quests.filter((q) => q.status === 'assigned').length, due }
}

/** null — ещё загружаем (подпись держит место). */
export function useSessionSteps(lang: AppLang, doneToday: ReadonlySet<ActivityType> | null): TodayPlanItem[] | null {
  const inputs = useAsyncData(() => loadInputs(lang), [lang])
  if (inputs.loading || !doneToday) return null
  const d = inputs.data
  const plan = buildTodayPlan(d?.cfg ?? null, { pendingAssignments: d?.pending ?? 0, activeQuests: d?.quests ?? 0, weekday: new Date().getDay() })
  return sessionSteps(plan, doneToday, { noReview: d?.due === 0 })
}
