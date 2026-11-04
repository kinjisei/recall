// ============================================================================
// Схемы ответа экзаменатора (JSON Schema) — модель строит ответ строго по
// ним, и JSON не ломается (api/_geminiBody.ts, журнал п.77). Порядок ключей
// — порядок ответа: сначала все ошибки, потом ступени (доказательства раньше
// оценки). Меняешь форму — меняй и разбор в lib/writingGrade (parseIelts,
// parseCefr): держит scripts/test-writing-examiner.mjs.
// ============================================================================

import { CEFR_LEVELS } from './cefr'
import { modelLimits, type IeltsKind } from './ielts'

type Schema = Record<string, unknown>

const str: Schema = { type: 'string' }
const strList: Schema = { type: 'array', items: str }
const obj = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties) })

const ERRORS: Schema = {
  type: 'array',
  items: obj({ was: str, fix: str, type: { type: 'string', enum: ['grammar', 'coherence', 'vocab', 'spelling'] }, why: str }),
}
/** У высшей ступени `need` пустой — «следующей ступени нет» (null схема не держит у всех моделей). */
const NEXT: Schema = obj({ need: str, was: str, fix: str })
const TAIL: Record<string, Schema> = {
  focus: { type: 'array', items: obj({ type: str, why: str, examples: { type: 'array', items: obj({ was: str, fix: str }) } }) },
  strengths: strList,
  topics: strList,
  words: strList,
  rewrites: { type: 'array', items: obj({ was: str, better: str }) },
}

export function ieltsSchema(kind: IeltsKind): Schema {
  const mark = obj({ band: { type: 'integer', minimum: 0, maximum: 9 }, fits: str, next: NEXT })
  return obj({
    errors: ERRORS,
    criteria: obj({ task: mark, coherence: mark, lexis: mark, grammar: mark }),
    limits: { type: 'array', items: { type: 'string', enum: modelLimits(kind) } },
    ...TAIL,
  })
}

export function cefrSchema(): Schema {
  const mark = obj({ level: { type: 'string', enum: [...CEFR_LEVELS] }, fits: str, next: NEXT })
  return obj({
    errors: ERRORS,
    aspects: obj({ task: mark, range: mark, accuracy: mark, coherence: mark }),
    targetWords: { type: 'array', items: obj({ w: str, used: { type: 'boolean' } }) },
    targetGrammar: { type: 'array', items: obj({ t: str, used: { type: 'boolean' } }) },
    ...TAIL,
  })
}
