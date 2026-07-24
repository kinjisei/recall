// ============================================================================
// Recall — общие типы. Отражают таблицы в Supabase (см. docs/ARCHITECTURE.md §5).
// Все воркеры импортируют типы ОТСЮДА и не плодят свои дубликаты.
// ============================================================================

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

/** Язык изучения. Приложение объединяет английский и испанский. */
export type AppLang = 'en' | 'es'

/** Оценка ответа на карточку (для FSRS). */
export type Rating = 'again' | 'hard' | 'good' | 'easy'

export type Role = 'learner' | 'teacher'

export type CardSource = 'manual' | 'reader' | 'ai'

export type ReviewStateName = 'new' | 'learning' | 'review' | 'relearning'


/** Тип занятия для activity_log (стрик и статистика). */
export type ActivityType =
  | 'flashcards'
  | 'reader'
  | 'pronunciation'
  | 'conversation'
  | 'writing'
  | 'grammar'
  | 'practice'
  | 'assignment'
  // «идеальный день»: все пункты плана дня выполнены (items_done=0 — не
  // искажает счётчики; сам факт дня считают диагностика и отчёт родителям)
  | 'perfect'

export interface Profile {
  id: string
  display_name: string | null
  level: CEFRLevel
  native_lang: string
  role: Role
  created_at: string
}

export interface Deck {
  id: string
  owner_id: string
  title: string
  description: string | null
  is_shared: boolean
  lang: AppLang
  created_at: string
}

export interface Card {
  id: string
  deck_id: string
  front: string
  back: string | null
  example: string | null
  ipa: string | null
  audio_url: string | null
  source: CardSource
  created_at: string
}

export interface ReviewState {
  id: string
  card_id: string
  user_id: string
  stability: number | null
  difficulty: number | null
  due: string
  last_review: string | null
  reps: number
  lapses: number
  state: ReviewStateName
}

/** Реплика для AI-чата (то, что летит в /api/gemini; не таблица БД). */
export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * ТИП ЗАДАЧИ для AI — единственное, что клиент сообщает про свой запрос.
 * Модель, класс квоты и право на вызов выбирает СЕРВЕР по этому типу
 * (карта — api/_tasks.ts). Клиент НЕ выбирает уровень модели: раньше он слал
 * tier, и любой вошедший мог поставить tier:'max', уводя обычную реплику
 * Диалога на дефицитные Pro-модели и выжигая их общую суточную квоту
 * (пентест, заход 18). Теперь подделать можно только НАЗВАНИЕ задачи, а у
 * каждой задачи уровень модели зафиксирован на сервере.
 *   word/definition/batch — перевод и определения слов (лёгкие модели);
 *   dialog/writing/quest/review — разговорные и проверочные задачи;
 *   material/program — генерация у преподавателя (Pro-модели, только role='teacher').
 */
export type AiTask =
  | 'word'
  | 'definition'
  | 'batch'
  | 'dialog'
  | 'writing'
  | 'quest'
  | 'review'
  | 'material'
  | 'program'

/** AI-квест по грамматике: учитель назначает, ученица играет с AI. */
export interface GrammarQuest {
  id: string
  teacher_id: string
  student_id: string
  lang: AppLang
  level: string
  /** Целевая грамматическая тема («Past Simple», «Conditionals»…). */
  topic: string
  /** Сценарий («Побег из комнаты», «Собеседование»…). */
  scenario: string
  /** Сколько верных ответов нужно для завершения. */
  target: number
  progress: number
  status: 'assigned' | 'completed'
  /** Переписка (сырые реплики, включая служебные строки вердиктов). */
  messages: ChatTurn[] | null
  created_at: string
  completed_at: string | null
}

// ---------------------------------------------------------------------------
// Программа обучения по неделям (таблица study_plans): AI составляет по
// диагностике, преподаватель утверждает, ученица видит свою неделю.
// ---------------------------------------------------------------------------

/** Тип пункта недели — определяет иконку и куда ведёт ссылка у ученицы. */
export type PlanItemType =
  | 'grammar' // урок грамматики (topicId — из встроенных уроков)
  | 'words' // лексика: паки/карточки
  | 'reading' // тексты и диалоги
  | 'speech' // произношение
  | 'dialog' // разговор с AI
  | 'custom' // всё остальное (свободная формулировка)

/** Один пункт недельного плана. */
export interface PlanItem {
  type: PlanItemType
  /** Короткая формулировка («Past Simple: вопросы», «20 слов „Еда“»). */
  title: string
  /** Пояснение для ученицы (зачем/как заниматься), по-русски. */
  note: string
  /** id встроенного урока грамматики (только для type='grammar'). */
  topicId?: number
}

/** Одна неделя программы. */
export interface PlanWeek {
  title: string
  /** Главный фокус недели, по-русски. */
  focus: string
  items: PlanItem[]
}

/** Программа обучения (таблица study_plans). */
export interface StudyPlan {
  id: string
  teacher_id: string
  student_id: string
  lang: AppLang
  level: string
  goal: string
  /** Комментарий AI: логика программы (показывается преподавателю). */
  summary: string
  /** День старта — от него считается текущая неделя. */
  start_day: string
  weeks: PlanWeek[]
  status: 'active' | 'archived'
  created_at: string
}

// ---------------------------------------------------------------------------
// Испанский контент (перенесён из приложения spanish; лежит в src/data/spanish).
// Это встроенные данные, не таблицы БД.
// ---------------------------------------------------------------------------

/** Тема пака слов («Семья», «Еда» …). */
export interface SpanishTopic {
  id: number
  name: string
  level: string
  icon: string
}

/** Тема пака — общая форма для обоих языков (алиас, чтобы не ломать ES-код). */
export type WordTopic = SpanishTopic

/** Слово английского пака: английский + русский + пример (src/data/english). */
export interface EnglishWord {
  english: string
  russian: string
  example_en?: string
  level: string
  topic_id: number
}

/** Слово из пака: испанский + русский + пример. */
export interface SpanishWord {
  spanish: string
  russian: string
  example_es?: string
  example_ru?: string
  level: string
  topic_id: number
  frequency_rank?: number
}

/** Текст для чтения с переводом по абзацам. */
export interface SpanishReading {
  id: number
  title: string
  titleRu: string
  level: string
  paragraphs: { es: string; ru: string }[]
}

/** Диалог (сценка) с репликами и переводом. */
export interface SpanishDialogue {
  id: number
  title: string
  level: string
  lines: { speaker: string; es: string; ru: string }[]
}

/** Фраза для тренировки произношения (рус → исп). */
export interface SpanishSentence {
  id: number
  level: string
  ru: string
  es: string
}

/** Блок теории в уроке грамматики. */
export type GrammarTheoryBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  // пример на изучаемом языке: es — для испанских уроков, en — для английских
  | { type: 'example'; es?: string; en?: string; ru: string }

/** Упражнение в уроке грамматики. */
export type GrammarExercise =
  | { type: 'mcq'; prompt: string; options: string[]; answer: number }
  | { type: 'fill'; prompt: string; answer: string; hint?: string }
  | { type: 'order'; prompt: string; words: string[]; answer: string[] }

/** Тема (урок) грамматики: теория + упражнения. id присваивается загрузчиком. */
export interface GrammarTopic {
  id: number
  title: string
  level: string
  order: number
  theory: GrammarTheoryBlock[]
  exercises: GrammarExercise[]
}

/** Одно время в справочнике спряжений: окончания + примеры глаголов. */
export interface ConjugationTense {
  id: string
  name: string
  nameRu: string
  level: string
  usage: string
  example: string
  exampleRu: string
  endings: { label: string; forms: string[] }[]
  verbs: { infinitive: string; ru: string; irregular: boolean; forms: string[] }[]
}

/** Справочник спряжений целиком (persons — подписи 6 лиц). */
export interface ConjugationReference {
  persons: string[]
  tenses: ConjugationTense[]
}

/** Вопрос теста на определение уровня (placement). */
export interface PlacementQuestion {
  id: number
  level: string
  prompt: string
  options: string[]
  answer: number
}

/** Упражнение тренажёра окончаний (выбор правильной формы глагола). */
export interface EndingsExercise {
  id: number
  level: string
  prompt: string
  infinitive: string
  options: string[]
  answer: number
  rule: string
  explanation: string
}

// ---------------------------------------------------------------------------
// Фаза 4: режим «Преподаватель».
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Материалы преподавателя: сгенерированный текст + упражнения (фича Materials).
// ---------------------------------------------------------------------------

/** Категория упражнения материала. */
export type MaterialExerciseKind = 'comprehension' | 'grammar' | 'vocab'

/** Упражнение материала: формат грамматики + категория. */
export type MaterialExercise = GrammarExercise & { kind: MaterialExerciseKind }

/** План будущего материала (шаг 1 генерации, ответ AI). */
export interface MaterialPlan {
  comments: string
  vocabulary: string[]
  grammar_focus: string | null
  exercise_plan: { kind: MaterialExerciseKind; type: string; count: number; note: string }[]
}

/** Сохранённый материал (таблица materials). */
export interface Material {
  id: string
  teacher_id: string
  lang: AppLang
  level: string
  topic: string
  format: string
  length_range: string
  title: string | null
  body: string
  exercises: MaterialExercise[]
  plan: MaterialPlan | null
  created_at: string
}

export type AssignmentStatus = 'assigned' | 'submitted' | 'reviewed'

/** Ответ ученицы на одно упражнение. */
export interface AssignmentAnswer {
  index: number
  given: string
  auto_ok: boolean
}

/** Вердикт по одному упражнению (AI — черновик, учитель — финал). */
export interface ReviewItem {
  index: number
  ok: boolean
  comment: string
}

/** Снимок прошлой попытки (при переназначении материала). */
export interface AttemptSnapshot {
  answers: AssignmentAnswer[] | null
  auto_score: number | null
  auto_total: number | null
  teacher_review: ReviewItem[] | null
  submitted_at: string | null
  reviewed_at: string | null
  note: string | null
}

/** Назначение материала ученице + её работа (таблица material_assignments). */
export interface MaterialAssignment {
  id: string
  material_id: string
  student_id: string
  status: AssignmentStatus
  answers: AssignmentAnswer[] | null
  auto_score: number | null
  auto_total: number | null
  ai_review: ReviewItem[] | null
  teacher_review: ReviewItem[] | null
  submitted_at: string | null
  reviewed_at: string | null
  attempts: AttemptSnapshot[] | null
  note: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Перепроверка слов: учитель выбирает слова ученицы, она печатает их по памяти.
// ---------------------------------------------------------------------------

/** Результат по одному слову перепроверки. */
export interface WordCheckResult {
  card_id: string
  front: string // слово (для отчёта учителю, даже если карточку удалят)
  back: string | null
  given: string // что напечатала ученица
  ok: boolean
}

/** Назначение перепроверки слов (таблица word_checks). */
export interface WordCheck {
  id: string
  teacher_id: string
  student_id: string
  card_ids: string[]
  results: WordCheckResult[] | null
  created_at: string
  completed_at: string | null
}
