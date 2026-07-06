// ============================================================================
// Вопросы теста на определение уровня испанского (48 вопросов A1–B2).
// Грузится лениво (нужен только на экране теста).
// ============================================================================
import type { PlacementQuestion } from '../../types'
import placementJson from './placement_test.json'

export const placementQuestions = (
  placementJson as { questions: PlacementQuestion[] }
).questions
