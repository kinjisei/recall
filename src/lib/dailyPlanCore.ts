// ============================================================================
// План дня: какие пункты ученица видит на Главной каждый день.
// Настройка учителя хранится в teacher_students.daily_plan (jsonb, через RPC
// set_daily_plan); NULL — умный дефолт из 3 пунктов (решение владельца):
//   1) Слова (всегда — ядро FSRS);
//   2) приоритетный: несданное задание → активный квест → ротация;
//   3) ротация по дню недели (Чтение → Речь → Диалог → Грамматика).
// «Идеальный день» = выполнены ВСЕ пункты плана; серию (стрик) по-прежнему
// продлевает любое одно занятие — идеальный день только бонус сверху.
// buildTodayPlan — чистая функция, гоняется scripts/test-dailyplan.mjs.
// ============================================================================
import type { ActivityType } from '../types'

/** Пункты, которые учитель может включить в план (слова всегда включены). */
export type PlanKind = 'words' | 'reader' | 'grammar' | 'pronunciation' | 'conversation'

export interface DailyPlanConfig {
  /** Порядок = порядок на Главной. Без 'words' — он добавляется всегда. */
  kinds: PlanKind[]
  /** Задания и квесты сами попадают в план (вкл. по умолчанию). */
  auto: boolean
}

/** Пункт плана на сегодня (Главная рендерит по нему RowCard). */
export interface TodayPlanItem {
  key: string
  to: string
  title: string
  desc: string
  /** Какие типы activity_log закрывают пункт. */
  types: ActivityType[]
}

const KIND_ITEMS: Record<PlanKind, Omit<TodayPlanItem, 'key'>> = {
  words: { to: '/practice', title: 'Слова', desc: 'Повторить и потренировать', types: ['flashcards', 'practice'] },
  reader: { to: '/study?view=reader', title: 'Чтение', desc: 'Текст и новые слова', types: ['reader'] },
  grammar: { to: '/grammar', title: 'Грамматика', desc: 'Урок или тренажёр', types: ['grammar'] },
  pronunciation: { to: '/pronunciation', title: 'Речь', desc: 'Произношение вслух', types: ['pronunciation'] },
  conversation: { to: '/conversation', title: 'Диалог', desc: 'Поговорить с AI', types: ['conversation', 'writing'] },
}

const ROTATION: PlanKind[] = ['reader', 'pronunciation', 'conversation', 'grammar']

const item = (kind: PlanKind): TodayPlanItem => ({ key: kind, ...KIND_ITEMS[kind] })

export interface PlanContext {
  pendingAssignments: number
  activeQuests: number
  /** 0–6 (Date.getDay()). */
  weekday: number
}

/**
 * План на сегодня. cfg=null — умный дефолт из 3 пунктов; с настройкой
 * учителя — Слова + выбранные пункты (+ задание/квест, если auto), максимум 4.
 */
export function buildTodayPlan(cfg: DailyPlanConfig | null, ctx: PlanContext): TodayPlanItem[] {
  const out: TodayPlanItem[] = [item('words')]

  const autoItem: TodayPlanItem | null =
    ctx.pendingAssignments > 0
      ? {
          key: 'assignment',
          to: '/assignments',
          title: 'Задание от преподавателя',
          desc: `Несданных: ${ctx.pendingAssignments}`,
          types: ['assignment'],
        }
      : ctx.activeQuests > 0
        ? {
            key: 'quest',
            to: '/quests',
            title: 'AI-квест',
            desc: 'Продолжи приключение',
            types: ['grammar'],
          }
        : null

  if (cfg) {
    if (cfg.auto && autoItem) out.push(autoItem)
    for (const k of cfg.kinds) {
      if (k === 'words' || out.some((i) => i.key === k)) continue
      if (out.length >= 4) break
      out.push(item(k))
    }
    // учитель снял всё — хотя бы ротация, чтобы план не был из одного пункта
    if (out.length === 1) out.push(item(ROTATION[ctx.weekday % ROTATION.length]))
    return out
  }

  // умный дефолт: 3 пункта
  if (autoItem) out.push(autoItem)
  const rot1 = ROTATION[ctx.weekday % ROTATION.length]
  const rot2 = ROTATION[(ctx.weekday + 1) % ROTATION.length]
  for (const k of [rot1, rot2]) {
    if (out.length >= 3) break
    if (!out.some((i) => i.key === k)) out.push(item(k))
  }
  return out.slice(0, 3)
}

/** Все пункты выполнены? (по типам активности за сегодня) */
export function isPerfectDay(plan: TodayPlanItem[], doneToday: Set<ActivityType>): boolean {
  return plan.length >= 2 && plan.every((p) => p.types.some((t) => doneToday.has(t)))
}

