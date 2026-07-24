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
import type { AiTask } from '../src/types'
import type { AiTier } from './_core.js'
import type { QuotaKind } from './_auth.js'

export interface TaskSpec {
  /** Уровень модели (цепочка фолбэков — GEMINI_TIER_CHAINS в _core). */
  tier: AiTier
  /** Из какого суточного кармана списывать (см. «КЛАССЫ КВОТ» в schema.sql). */
  quota: QuotaKind
  /** Требует роли преподавателя (Pro-модели — только под генерацию учителю). */
  teacherOnly?: boolean
}

export const AI_TASKS: Record<AiTask, TaskSpec> = {
  // лёгкие массовые задачи — мини-модели, отдельный большой карман (900/300/100)
  word: { tier: 'lite', quota: 'light' },
  definition: { tier: 'lite', quota: 'light' },
  batch: { tier: 'lite', quota: 'light' },

  // «AI-действия» из тарифов (200/12/5 в сутки)
  dialog: { tier: 'standard', quota: 'heavy' },
  writing: { tier: 'standard', quota: 'heavy' },
  quest: { tier: 'standard', quota: 'heavy' },
  review: { tier: 'standard', quota: 'heavy' },

  // Pro-модели: единицы вызовов в день, и только у преподавателя
  material: { tier: 'max', quota: 'heavy', teacherOnly: true },
  program: { tier: 'max', quota: 'heavy', teacherOnly: true },
}

/** Спека задачи по присланному клиентом названию (undefined — название чужое). */
export function taskSpec(task: unknown): TaskSpec | undefined {
  return typeof task === 'string' && Object.prototype.hasOwnProperty.call(AI_TASKS, task)
    ? AI_TASKS[task as AiTask]
    : undefined
}
