# Карта кода (сгенерировано)

> Генерирует `node scripts/arch-map.mjs`. Руками не править — перезапустить.

Файлов: 207, строк кода: 37962 (без `src/data`).

## Разделы (features/)

| Раздел | Файлов | Строк | Таблицы | RPC | Развилки языка | Зависит от |
|---|---|---|---|---|---|---|
| teacher | 24 | 6542 | — | 0 | 9 | components, context, features/homework, features/program, features/writing, lib/activity, lib/activityDays, lib/billing, lib/dailyPlan, lib/dbError, lib/diagnostics, lib/dynamics, lib/homework, lib/homeworkRules, lib/homeworkSuggest, lib/materials, lib/myTexts, lib/placement, lib/profile, lib/quests, lib/studentSignals, lib/studyPlan, lib/teacher, lib/text, lib/useAsyncData, lib/useScrollTop, lib/useUrlState, lib/wordChecks, lib/wordPacks, lib/writing, src-root |
| words | 9 | 2098 | — | 0 | 5 | components, lib/activity, lib/cards, lib/definitions, lib/fsrs, lib/gameMisses, lib/level, lib/selfCorrect, lib/speech, lib/text, lib/wordChecks, lib/wordPool, src-root |
| grammar | 4 | 1851 | — | 0 | 3 | components, context, lib/activity, lib/mistakes, lib/random, lib/speech, lib/text, lib/useScrollTop, lib/useUrlState, lib/verbMistakes, src-root |
| writing | 5 | 968 | writing_submissions | 0 | 7 | components, context, lib/activity, lib/gemini, lib/level, lib/supabase, lib/useScrollTop, lib/writing, lib/writingGrade, src-root |
| auth | 4 | 945 | — | 0 | — | components, context, lib/access, lib/analytics, lib/contacts, lib/passwordReset, lib/pendingRole, lib/supabase |
| flashcards | 4 | 884 | — | 0 | 2 | components, context, lib/activity, lib/cards, lib/fsrs, lib/gameMisses, lib/speech, lib/storage, lib/text, lib/wordChecks, lib/wordPacks |
| reader | 4 | 823 | — | 0 | 2 | components, context, lib/level, lib/myTexts, lib/settings, lib/speech, lib/useScrollTop, lib/useUrlState, src-root |
| onboarding | 2 | 733 | profiles | 0 | 10 | components, context, lib/analytics, lib/esLevel, lib/guided, lib/onboarding, lib/placement, lib/profile, lib/random, lib/supabase, lib/teacher, src-root |
| study | 2 | 717 | — | 0 | 6 | components, context, features/flashcards, features/reader, features/words, lib/esLevel, lib/guided, lib/homework, lib/materials, lib/placement, lib/profile, lib/quests, lib/studyPlan, lib/supabase, lib/useScrollTop, lib/useUrlState, lib/writing |
| practice | 2 | 632 | — | 0 | 2 | components, context, features/flashcards, features/words, lib/activity, lib/cards, lib/fsrs, lib/guided, lib/level, lib/mistakes, lib/morph, lib/useScrollTop, lib/viewTransition, lib/wordPool, src-root |
| dashboard | 1 | 605 | — | 0 | 3 | components, context, features/teacher, lib/activity, lib/billing, lib/cards, lib/dailyPlan, lib/esLevel, lib/fsrs, lib/guided, lib/profile, lib/quests, lib/speech, lib/studyPlan, lib/wordPool |
| settings | 3 | 544 | profiles | 0 | 4 | components, context, features/auth, lib/account, lib/contacts, lib/database.types, lib/esLevel, lib/passwordReset, lib/profile, lib/settings, lib/speech, lib/supabase |
| admin | 1 | 541 | — | 2 | — | components, lib/admin, lib/supabase |
| pronunciation | 1 | 502 | cards, review_states | 0 | 1 | components, context, lib/activity, lib/cards, lib/level, lib/random, lib/speech, lib/supabase, lib/transcribe, src-root |
| conversation | 1 | 437 | messages | 0 | 10 | components, context, lib/activity, lib/aiHealth, lib/chatHistory, lib/esLevel, lib/gemini, lib/profile, lib/supabase, lib/useChatList, lib/useKeyboardInset |
| quests | 1 | 347 | — | 0 | 3 | components, lib/activity, lib/correctionRules, lib/gemini, lib/quests, lib/useAsyncData, lib/useChatList, lib/useKeyboardInset, lib/useUrlState |
| progress | 1 | 337 | review_states | 0 | — | components, context, lib/activity, lib/cards, lib/diagnostics, lib/diagnosticsBrief, lib/fsrs, lib/supabase, lib/wordChecks |
| landing | 1 | 318 | — | 0 | — | components, lib/contacts |
| homework | 1 | 271 | — | 0 | — | components, lib/homework, lib/homeworkLinks |
| legal | 1 | 227 | — | 0 | — | components, lib/contacts |
| billing | 1 | 186 | — | 0 | — | components, context, lib/billing |
| program | 2 | 165 | — | 0 | — | components, lib/studyPlan, lib/useAsyncData |

## Модули lib/

| Модуль | Строк | Кем используется | Таблицы / RPC |
|---|---|---|---|
| database.types | 1307 | f:settings, lib/cards, lib/studyPlan, lib/supabase | — |
| materials | 622 | f:study, f:teacher | material_assignments, materials, profiles, assign_material(), finish_material_review(), reassign_material(), save_material_ai_review(), self_assign_material(), submit_material(), unassign_material() |
| homeworkRules | 536 | f:teacher, lib/homeworkSuggest | — |
| teacher | 336 | components, f:onboarding, f:teacher, lib/studentSignals | activity_log, cards, deck_assignments, decks, profiles, teacher_students, become_teacher(), ensure_invite_code(), join_teacher(), regenerate_invite_code(), set_student_seat() |
| wordPool | 311 | f:dashboard, f:practice, f:words | cards |
| homeworkSuggest | 305 | f:teacher | profiles |
| writing | 299 | f:study, f:teacher, f:writing | writing_task_assignments, writing_tasks, assign_writing_task(), finish_writing_review(), reassign_writing(), submit_writing(), unassign_writing_task() |
| passwordReset | 250 | f:auth, f:settings | — |
| definitions | 235 | f:words | — |
| activity | 224 | components, f:conversation, f:dashboard, f:flashcards, f:grammar, f:practice, f:progress, f:pronunciation, f:quests, f:teacher, f:words, f:writing | activity_log, log_activity() |
| fsrs | 223 | f:dashboard, f:flashcards, f:practice, f:progress, f:words, lib/wordChecks | cards, review_states |
| studyPlan | 217 | f:dashboard, f:program, f:study, f:teacher | study_plans, replace_study_plan() |
| diagnostics | 215 | f:progress, f:teacher, lib/diagnosticsBrief, lib/homeworkSuggest, lib/studyPlan | activity_log, grammar_mistakes, material_assignments |
| cards | 213 | components, f:dashboard, f:flashcards, f:practice, f:progress, f:pronunciation, f:words, lib/fsrs, lib/guided, lib/wordPool | cards, decks, review_states |
| writingGrade | 195 | f:writing | — |
| homeworkView | 193 | lib/homework, lib/studentSignals | — |
| wordPacks | 193 | f:flashcards, f:teacher | — |
| wordChecks | 188 | f:flashcards, f:progress, f:teacher, f:words, lib/cards, lib/diagnostics, lib/homeworkSuggest | cards, decks, review_states, word_checks, assign_word_check(), submit_word_check() |
| guided | 162 | components, f:dashboard, f:onboarding, f:practice, f:study | — |
| dbError | 152 | components, f:teacher, lib/account, lib/admin, lib/dailyPlan, lib/materials, lib/placement, lib/studyPlan, lib/teacher, lib/wordChecks, lib/writing | — |
| gemini | 149 | f:conversation, f:quests, f:writing, lib/analyze, lib/contextDict, lib/definitions, lib/explain, lib/homeworkSuggest, lib/materials, lib/phrase, lib/studyPlan, lib/textAnalysis, lib/writing, lib/writingGrade | — |
| textAnalysis | 148 | components, lib/textAnalysisCache | — |
| viewTransition | 144 | components, f:practice, lib/useUrlState | — |
| billing | 136 | components, f:billing, f:dashboard, f:teacher | get_my_plan() |
| transcribe | 132 | f:pronunciation | — |
| admin | 126 | f:admin | admin_find_user(), admin_set_plan() |
| chatHistory | 120 | f:conversation | conversations, messages |
| profile | 120 | components, context, f:conversation, f:dashboard, f:onboarding, f:settings, f:study, f:teacher, lib/account, lib/level, lib/teacher, lib/wordPool | profiles |
| routeChunks | 118 | src-root, components | — |
| studentSignals | 116 | f:teacher | — |
| dynamics | 113 | f:teacher, lib/diagnostics | — |
| analyze | 111 | components, lib/textAnalysis | — |
| dailyPlanCore | 110 | lib/dailyPlan | — |
| selfCorrect | 110 | components, f:words | — |
| access | 104 | components, f:auth | profiles |
| myTexts | 101 | f:reader, f:teacher | — |
| speech | 100 | components, f:dashboard, f:flashcards, f:grammar, f:pronunciation, f:reader, f:settings, f:words | — |
| text | 100 | components, f:flashcards, f:grammar, f:teacher, f:words, lib/homeworkRules, lib/homeworkSuggest, lib/materials, lib/selfCorrect | — |
| analytics | 99 | components, f:auth, f:onboarding, lib/admin, lib/cards, lib/errorLog, lib/gemini, lib/materials, lib/teacher | track_event() |
| diagnosticsBrief | 97 | f:progress, lib/homeworkSuggest, lib/materials, lib/studyPlan | — |
| homework | 97 | f:homework, f:study, f:teacher, lib/homeworkLinks, lib/homeworkRules | choose_homework_item(), complete_homework_item(), create_homework(), get_homework(), get_homework_many() |
| useUrlState | 96 | f:grammar, f:quests, f:reader, f:study, f:teacher | — |
| distractors | 94 | lib/wordPool | — |
| assignmentScore | 91 | lib/diagnostics | — |
| placement | 89 | f:onboarding, f:study, f:teacher | placement_requests, assign_placement(), cancel_placement(), submit_placement() |
| mistakes | 86 | f:grammar, f:practice | grammar_mistakes |
| contextDict | 85 | components | — |
| dictionary | 85 | components, lib/definitions | — |
| account | 83 | f:settings | activity_log, cards, conversations, decks, grammar_mistakes, messages, profiles, review_states, writing_submissions, delete_my_account() |
| errorLog | 82 | src-root, components | — |
| pickRound | 80 | lib/wordPool | — |
| quests | 71 | f:dashboard, f:quests, f:study, f:teacher, lib/diagnostics | grammar_quests, assign_grammar_quest(), delete_grammar_quest(), quest_correct_answer(), save_quest_messages() |
| cefr | 68 | lib/textAnalysis | — |
| homeworkLinks | 67 | f:homework | — |
| activityDays | 61 | f:teacher, lib/diagnostics, lib/studentSignals, lib/teacher | — |
| gameMisses | 61 | f:flashcards, f:words | — |
| useAsyncData | 60 | f:program, f:quests, f:teacher | — |
| settings | 59 | f:reader, f:settings, lib/speech | — |
| aiHealth | 55 | f:conversation | — |
| dailyPlan | 55 | f:dashboard, f:teacher | teacher_students, set_daily_plan() |
| onboarding | 55 | components, f:onboarding | activity_log |
| correctionRules | 54 | f:quests, lib/writingGrade | — |
| esLevel | 53 | f:conversation, f:dashboard, f:onboarding, f:settings, f:study, lib/level, lib/profile, lib/wordPool | profiles |
| materialExercises | 52 | lib/materials | — |
| feedback | 51 | components | track_event() |
| textChunks | 51 | components, lib/textAnalysis | — |
| morph | 50 | components, f:practice | — |
| supabase | 49 | context, f:admin, f:auth, f:conversation, f:onboarding, f:progress, f:pronunciation, f:settings, f:study, f:writing, lib/access, lib/account, lib/activity, lib/admin, lib/analytics, lib/billing, lib/cards, lib/chatHistory, lib/dailyPlan, lib/diagnostics, lib/esLevel, lib/feedback, lib/fsrs, lib/gemini, lib/homework, lib/homeworkSuggest, lib/level, lib/materials, lib/mistakes, lib/onboarding, lib/passwordReset, lib/placement, lib/profile, lib/quests, lib/studyPlan, lib/teacher, lib/transcribe, lib/wordChecks, lib/wordPool, lib/writing | table |
| useCountUp | 49 | components | — |
| useChatList | 46 | f:conversation, f:quests | — |
| storage | 45 | context, f:flashcards, lib/definitions, lib/esLevel, lib/gameMisses, lib/mistakes, lib/myTexts, lib/onboarding, lib/profile, lib/recentWords, lib/settings, lib/studyPlan, lib/verbMistakes, lib/wordPool | — |
| textAnalysisCache | 42 | components | — |
| recentWords | 38 | lib/wordPool | — |
| explain | 37 | components | — |
| pendingRole | 37 | components, f:auth | — |
| useKeyboardInset | 34 | components, f:conversation, f:quests | — |
| verbMistakes | 31 | f:grammar | — |
| phrase | 27 | components | — |
| level | 25 | f:practice, f:pronunciation, f:reader, f:words, f:writing | — |
| contacts | 21 | components, f:auth, f:landing, f:legal, f:settings, lib/dbError, lib/teacher | — |
| random | 21 | f:grammar, f:onboarding, f:pronunciation, lib/wordPool | — |
| useScrollTop | 14 | f:grammar, f:practice, f:reader, f:study, f:teacher, f:writing | — |

## Прямые импорты между разделами (17)

- `src/features/dashboard/DashboardPage.tsx` → `src/features/teacher/TeacherBlock.tsx`
- `src/features/practice/GrammarMixMode.tsx` → `src/features/words/GameShell.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/flashcards/DeckReview.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/words/DictationMode.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/words/MatchMode.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/words/QuizModes.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/words/SentenceBuilder.tsx`
- `src/features/practice/PracticePage.tsx` → `src/features/words/SprintMode.tsx`
- `src/features/settings/SecuritySection.tsx` → `src/features/auth/authUi.tsx`
- `src/features/study/StudyPage.tsx` → `src/features/flashcards/DeckReview.tsx`
- `src/features/study/StudyPage.tsx` → `src/features/flashcards/PacksSheet.tsx`
- `src/features/study/StudyPage.tsx` → `src/features/reader/ReaderPage.tsx`
- `src/features/study/StudyPage.tsx` → `src/features/words/AddCardForm.tsx`
- `src/features/study/StudyPage.tsx` → `src/features/words/MyWords.tsx`
- `src/features/teacher/AssignmentsPage.tsx` → `src/features/homework/StudentHomework.tsx`
- `src/features/teacher/ProgramSection.tsx` → `src/features/program/PlanView.tsx`
- `src/features/teacher/WritingSection.tsx` → `src/features/writing/WritingReviewScreen.tsx`

## Экраны, которые ходят в базу напрямую, мимо lib/ (8)

- `src/features/admin/AdminPage.tsx`: admin_funnel(), get_my_plan()
- `src/features/conversation/ConversationPage.tsx`: messages
- `src/features/onboarding/OnboardingFlow.tsx`: profiles
- `src/features/onboarding/PlacementTest.tsx`: profiles
- `src/features/progress/ProgressPage.tsx`: review_states
- `src/features/pronunciation/PronunciationPage.tsx`: cards, review_states
- `src/features/settings/SettingsPage.tsx`: profiles
- `src/features/writing/QuickWriteCheck.tsx`: writing_submissions

## Модули lib/ без единого потребителя (0)


## Развилки по языку: 92 в 41 файлах

- `src/features/conversation/ConversationPage.tsx`: 10
- `src/features/onboarding/OnboardingFlow.tsx`: 7
- `src/features/study/StudyPage.tsx`: 6
- `src/features/settings/SettingsPage.tsx`: 4
- `src/features/teacher/WritingSection.tsx`: 4
- `src/features/writing/QuickWriteCheck.tsx`: 4
- `src/features/dashboard/DashboardPage.tsx`: 3
- `src/features/grammar/GrammarPage.tsx`: 3
- `src/features/onboarding/PlacementTest.tsx`: 3
- `src/features/quests/QuestsPage.tsx`: 3
- `src/features/writing/WritingPage.tsx`: 3
- `src/lib/homeworkSuggest.ts`: 3
- `src/lib/materials.ts`: 3
- `src/lib/wordPool.ts`: 3
- `src/features/teacher/materials/RequestForm.tsx`: 2
- `src/features/words/MatchMode.tsx`: 2
- `src/features/words/SentenceBuilder.tsx`: 2
- `src/lib/analyze.ts`: 2
- `src/lib/speech.ts`: 2
- `src/lib/textAnalysis.ts`: 2
- `src/components/WordSheet.tsx`: 1
- `src/features/flashcards/PacksSheet.tsx`: 1
- `src/features/flashcards/WordCheckRunner.tsx`: 1
- `src/features/practice/GrammarMixMode.tsx`: 1
- `src/features/practice/PracticePage.tsx`: 1
- `src/features/pronunciation/PronunciationPage.tsx`: 1
- `src/features/reader/MyTextsBlock.tsx`: 1
- `src/features/reader/ReaderPage.tsx`: 1
- `src/features/teacher/DiagnosticsSection.tsx`: 1
- `src/features/teacher/PlacementSection.tsx`: 1
- `src/features/teacher/PrintSheet.tsx`: 1
- `src/features/words/AddCardForm.tsx`: 1
- `src/lib/contextDict.ts`: 1
- `src/lib/diagnosticsBrief.ts`: 1
- `src/lib/explain.ts`: 1
- `src/lib/level.ts`: 1
- `src/lib/phrase.ts`: 1
- `src/lib/studyPlan.ts`: 1
- `src/lib/wordPacks.ts`: 1
- `src/lib/writingGrade.ts`: 1
- `api/transcribe.ts`: 1

## Таблицы: кто их трогает (20)

- **activity_log** — 5 файл(ов): `lib/account.ts`, `lib/activity.ts`, `lib/diagnostics.ts`, `lib/onboarding.ts`, `lib/teacher.ts`
- **cards** — 7 файл(ов): `features/pronunciation/PronunciationPage.tsx`, `lib/account.ts`, `lib/cards.ts`, `lib/fsrs.ts`, `lib/teacher.ts`, `lib/wordChecks.ts`, `lib/wordPool.ts`
- **conversations** — 2 файл(ов): `lib/account.ts`, `lib/chatHistory.ts`
- **deck_assignments** — 1 файл(ов): `lib/teacher.ts`
- **decks** — 4 файл(ов): `lib/account.ts`, `lib/cards.ts`, `lib/teacher.ts`, `lib/wordChecks.ts`
- **grammar_mistakes** — 3 файл(ов): `lib/account.ts`, `lib/diagnostics.ts`, `lib/mistakes.ts`
- **grammar_quests** — 1 файл(ов): `lib/quests.ts`
- **material_assignments** — 2 файл(ов): `lib/diagnostics.ts`, `lib/materials.ts`
- **materials** — 1 файл(ов): `lib/materials.ts`
- **messages** — 3 файл(ов): `features/conversation/ConversationPage.tsx`, `lib/account.ts`, `lib/chatHistory.ts`
- **placement_requests** — 1 файл(ов): `lib/placement.ts`
- **profiles** — 10 файл(ов): `features/onboarding/OnboardingFlow.tsx`, `features/onboarding/PlacementTest.tsx`, `features/settings/SettingsPage.tsx`, `lib/access.ts`, `lib/account.ts`, `lib/esLevel.ts`, `lib/homeworkSuggest.ts`, `lib/materials.ts`, `lib/profile.ts`, `lib/teacher.ts`
- **review_states** — 6 файл(ов): `features/progress/ProgressPage.tsx`, `features/pronunciation/PronunciationPage.tsx`, `lib/account.ts`, `lib/cards.ts`, `lib/fsrs.ts`, `lib/wordChecks.ts`
- **study_plans** — 1 файл(ов): `lib/studyPlan.ts`
- **table** — 1 файл(ов): `lib/supabase.ts`
- **teacher_students** — 2 файл(ов): `lib/dailyPlan.ts`, `lib/teacher.ts`
- **word_checks** — 1 файл(ов): `lib/wordChecks.ts`
- **writing_submissions** — 2 файл(ов): `features/writing/QuickWriteCheck.tsx`, `lib/account.ts`
- **writing_task_assignments** — 1 файл(ов): `lib/writing.ts`
- **writing_tasks** — 1 файл(ов): `lib/writing.ts`

## RPC: кто их зовёт (40)

- **admin_find_user()** — `lib/admin.ts`
- **admin_funnel()** — `features/admin/AdminPage.tsx`
- **admin_set_plan()** — `lib/admin.ts`
- **assign_grammar_quest()** — `lib/quests.ts`
- **assign_material()** — `lib/materials.ts`
- **assign_placement()** — `lib/placement.ts`
- **assign_word_check()** — `lib/wordChecks.ts`
- **assign_writing_task()** — `lib/writing.ts`
- **become_teacher()** — `lib/teacher.ts`
- **cancel_placement()** — `lib/placement.ts`
- **choose_homework_item()** — `lib/homework.ts`
- **complete_homework_item()** — `lib/homework.ts`
- **create_homework()** — `lib/homework.ts`
- **delete_grammar_quest()** — `lib/quests.ts`
- **delete_my_account()** — `lib/account.ts`
- **ensure_invite_code()** — `lib/teacher.ts`
- **finish_material_review()** — `lib/materials.ts`
- **finish_writing_review()** — `lib/writing.ts`
- **get_homework()** — `lib/homework.ts`
- **get_homework_many()** — `lib/homework.ts`
- **get_my_plan()** — `features/admin/AdminPage.tsx`, `lib/billing.ts`
- **join_teacher()** — `lib/teacher.ts`
- **log_activity()** — `lib/activity.ts`
- **quest_correct_answer()** — `lib/quests.ts`
- **reassign_material()** — `lib/materials.ts`
- **reassign_writing()** — `lib/writing.ts`
- **regenerate_invite_code()** — `lib/teacher.ts`
- **replace_study_plan()** — `lib/studyPlan.ts`
- **save_material_ai_review()** — `lib/materials.ts`
- **save_quest_messages()** — `lib/quests.ts`
- **self_assign_material()** — `lib/materials.ts`
- **set_daily_plan()** — `lib/dailyPlan.ts`
- **set_student_seat()** — `lib/teacher.ts`
- **submit_material()** — `lib/materials.ts`
- **submit_placement()** — `lib/placement.ts`
- **submit_word_check()** — `lib/wordChecks.ts`
- **submit_writing()** — `lib/writing.ts`
- **track_event()** — `lib/analytics.ts`, `lib/feedback.ts`
- **unassign_material()** — `lib/materials.ts`
- **unassign_writing_task()** — `lib/writing.ts`
