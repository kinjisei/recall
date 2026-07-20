// ============================================================================
// Вопросы теста на определение уровня английского (60 вопросов A1–C1,
// авторские). Грузится лениво (нужен только на экране теста).
// ============================================================================
import type { PlacementQuestion } from '../../types'
import placementJson from './placement_test.json'

export const placementQuestions = (
  placementJson as { questions: PlacementQuestion[] }
).questions
