// Парадная дверь домена материалов (архитектура §2): экраны берут отсюда.
// Пока здесь правка упражнений руками и замок сданного (Ф2.25-3); остальное
// про материалы — в lib/materials и lib/materialExercises до переезда (PLAN.md Ф3).
export {
  blankDraft,
  buildExercise,
  editSpec,
  optionLimits,
  tfngButtons,
  toDraft,
  type EditField,
  type EditSpec,
  type EditTarget,
  type ExerciseDraft,
  type FieldText,
} from './edit'
export { checkEdit, exerciseProblems, type EditProblems, type EditResult } from './editCheck'
export { editLock, lockText, locksMaterial, namesList, type EditLock, type LockRow } from './lock'
export { copyMaterial, loadSwapCounters, saveMaterialExercises, swapExercise, type SwapCounters } from './api'
export { isStrongSwap, readSwap, STRONG_PER_DAY, SWAPS_PER_DAY, swapMessages, swapRow, type SwapInput, type SwapResult } from './swap'
