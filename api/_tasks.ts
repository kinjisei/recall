// ============================================================================
// Карта «тип задачи → модель, карман квоты, право на вызов».
// Файл с «_» — Vercel НЕ делает из него отдельную функцию.
//
// ЕДИНСТВЕННОЕ место, где решается, какой моделью обслужить запрос. Клиент
// присылает только НАЗВАНИЕ задачи (AiTask), уровень модели он выбрать не может.
// До захода 18 клиент слал tier напрямую, и любой вошедший мог отправить
// обычную реплику Диалога с tier:'max' — она уходила на дефицитные Pro-модели
// и жгла их общую суточную квоту (RPD у Pro крошечный), из-за чего у
// преподавателя падало качество генерации материалов. Параметр model закрыли
// раньше по той же причине — этот файл закрывает весь класс целиком.
// ============================================================================
import type { AiTask } from '../src/types/index.js'
import type { AiTier } from './_core.js'
import type { QuotaKind } from './_auth.js'

export interface TaskSpec {
  /** Уровень модели (цепочка фолбэков — GEMINI_TIER_CHAINS в _core). */
  tier: AiTier
  /** Из какого суточного кармана списывать (см. «КЛАССЫ КВОТ» в schema.sql). */
  quota: QuotaKind
  /**
   * Цена действия в ЭНЕРГИИ (docs/energy-design.md): 1 ⚡ = реплика Диалога.
   * light/speech — 0 (энергию не тратят, только анти-абьюз-кэп). Материалы и
   * программы — 0 (списываются НЕ энергией, а месячным лимитом генераций).
   */
  energyCost: number
  /** Материал/программа — списывается из месячного лимита генераций учителя. */
  generation?: boolean
  /** Требует роли преподавателя (Pro-модели — только под генерацию учителю). */
  teacherOnly?: boolean
}

export const AI_TASKS: Record<AiTask, TaskSpec> = {
  // лёгкие массовые задачи — мини-модели, отдельный большой карман; 0 энергии
  word: { tier: 'lite', quota: 'light', energyCost: 0 },
  definition: { tier: 'lite', quota: 'light', energyCost: 0 },
  batch: { tier: 'lite', quota: 'light', energyCost: 0 },

  // «AI-действия» — тратят энергию (dialog/quest/analyze = 1 ⚡; письмо/разбор = 2 ⚡)
  dialog: { tier: 'standard', quota: 'heavy', energyCost: 1 },
  quest: { tier: 'standard', quota: 'heavy', energyCost: 1 },
  // разбор выделенного фрагмента в читалке (фразовые глаголы/выражения) —
  // дешёвая модель теряла фразовые глаголы, нужна умная (проверено на проде)
  analyze: { tier: 'standard', quota: 'heavy', energyCost: 1 },
  writing: { tier: 'standard', quota: 'heavy', energyCost: 2 },
  review: { tier: 'standard', quota: 'heavy', energyCost: 2 },

  // Pro-модели: месячный лимит генераций (не энергия), только у преподавателя
  material: { tier: 'max', quota: 'heavy', energyCost: 0, generation: true, teacherOnly: true },
  program: { tier: 'max', quota: 'heavy', energyCost: 0, generation: true, teacherOnly: true },
}

/** Спека задачи по присланному клиентом названию (undefined — название чужое). */
export function taskSpec(task: unknown): TaskSpec | undefined {
  return typeof task === 'string' && Object.prototype.hasOwnProperty.call(AI_TASKS, task)
    ? AI_TASKS[task as AiTask]
    : undefined
}
