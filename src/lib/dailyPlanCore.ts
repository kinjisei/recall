// ============================================================================
// План дня: какие пункты ученик видит на Главной каждый день.
// Настройка учителя хранится в teacher_students.daily_plan (jsonb, через RPC
// set_daily_plan); NULL — умный дефолт из 3 пунктов (решение владельца):
//   1) Повторение слов (всегда — ядро FSRS);
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
  words: { to: '/practice', title: 'Повторение', desc: 'Повторить и потренировать', types: ['flashcards', 'practice'] },
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
            // 'quest', НЕ 'grammar': иначе пункт закрывался обычным уроком
            // грамматики, без реального прохождения квеста
            types: ['quest'],
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
    // (индекс по модулю длины всегда в границах ROTATION)
    if (out.length === 1) out.push(item(ROTATION[ctx.weekday % ROTATION.length]!))
    return out
  }

  // умный дефолт: 3 пункта (индекс по модулю длины всегда в границах ROTATION)
  if (autoItem) out.push(autoItem)
  const rot1 = ROTATION[ctx.weekday % ROTATION.length]!
  const rot2 = ROTATION[(ctx.weekday + 1) % ROTATION.length]!
  for (const k of [rot1, rot2]) {
    if (out.length >= 3) break
    if (!out.some((i) => i.key === k)) out.push(item(k))
  }
  return out.slice(0, 3)
}

// ---------------------------------------------------------------------------
// «Начать занятие» идёт по плану дня (журнал п.76 (10)): шаги — пункты
// плана, которые ещё не сделаны сегодня; подпись под кнопкой — из тех же
// шагов («~20 минут · слова → грамматика → диалог»). Сделан пункт — по тем же
// типам активности, что отмечают его «Сделано» на Главной: план и занятие не
// расходятся.
// ---------------------------------------------------------------------------

/** Сколько минут на шаг в подписи: задание и квест длиннее. */
const STEP_MINUTES: Record<string, number> = { assignment: 10, quest: 10 }
/** Шаг в подписи под «Начать занятие». */
const STEP_NAME: Record<string, string> = {
  words: 'слова',
  reader: 'чтение',
  grammar: 'грамматика',
  pronunciation: 'речь',
  conversation: 'диалог',
  assignment: 'задание',
  quest: 'квест',
}

/**
 * Шаги занятия: пункты плана, которые сегодня ещё не сделаны, по порядку
 * плана. Всё сделано — весь план заново (занятие можно пройти ещё раз).
 * `noReview` — повторять нечего (слов нет или ни одно не подошло): шаг слов
 * пропускаем, пустой раунд только обескураживает.
 */
export function sessionSteps(plan: TodayPlanItem[], doneToday: ReadonlySet<ActivityType>, { noReview = false } = {}): TodayPlanItem[] {
  const usable = noReview && plan.length > 1 ? plan.filter((p) => p.key !== 'words') : plan
  const left = usable.filter((p) => !p.types.some((t) => doneToday.has(t)))
  return left.length ? left : usable
}

/** «~15 минут · слова → чтение → речь» — подпись под «Начать занятие». */
export function sessionCaption(steps: TodayPlanItem[]): string {
  const minutes = steps.reduce((sum, s) => sum + (STEP_MINUTES[s.key] ?? 5), 0)
  return `~${minutes} минут · ${steps.map((s) => STEP_NAME[s.key] ?? s.title.toLowerCase()).join(' → ')}`
}

/** Все пункты выполнены? (по типам активности за сегодня) */
export function isPerfectDay(plan: TodayPlanItem[], doneToday: Set<ActivityType>): boolean {
  return plan.length >= 2 && plan.every((p) => p.types.some((t) => doneToday.has(t)))
}

