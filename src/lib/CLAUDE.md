# lib — логика вне экранов (старая папка, переезжает в `domains/`)

## Простыми словами

Здесь правила, которые нужны нескольким экранам сразу: как устроены слова и
повторение, профиль и уровень, тарифы, домашка, материалы, письмо, AI-задачи.
Экраны (`features/`) зовут эти модули, а не считают сами.

Это старая папка. По новой архитектуре её модули переезжают в `domains/`
вместе со своими разделами (PLAN.md Ф3). Пока не переехали, правила модуля
описаны там, где живёт его механика: в начале такого файла стоит строка
`// Описание: src/features/<раздел>/CLAUDE.md`. Какой модуль чей — в блоке
внизу, он строится сам. Модули без указателя описаны здесь.

| Модуль | Что важно знать |
|---|---|
| `cards.ts`, `fsrs.ts` | слова ученика и расписание повторений (FSRS); общие сигнатуры — их зовут многие разделы |
| `wordPool.ts`, `distractors.ts`, `recentWords.ts`, `pickRound.ts` | материал для игр: пул слов, обманки, «не повторять только что бывшее» |
| `profile.ts` | профиль с кэшем; колонки — только списком `PROFILE_COLUMNS` (`supabase/CLAUDE.md`); `loadProfile` отличает «нет связи» (бросает) от «профиля нет» (`null`), `getProfile` — прежний, сбой = `null` |
| `level.ts`, `esLevel.ts` | уровень: английский — из профиля, испанский — пока на устройстве (перенос — PLAN.md Ф3.3) |
| `activity.ts` | занятия и серия дней: `logActivity` (не бросает), `getStreak` |
| `text.ts` | `answerMatches` — сверка ответов, парная к SQL `norm_typed` |
| `contextDict.ts`, `dictionary.ts`, `definitions.ts` | перевод слова в контексте, словарь, определения (лёгкие задачи AI, ⚡ не стоят) |
| `chatHistory.ts`, `useChatList.ts` | память «Диалога» и раскладка ленты чата (Диалог, AI-квесты) |
| `teacher.ts`, `materials.ts`, `studyPlan.ts`, `diagnostics.ts`, `quests.ts`, `dailyPlan.ts` | студия: ученики и приглашения, материалы (балл считает сервер), программа, диагностика, квесты, план дня |
| `errorLog.ts`, `analytics.ts` | ошибки с прода и события воронки (`/admin`) |

## Правила, которые нельзя нарушить

- **Механика описана в разделе — указатель в начале файла.** Строка
  `// Описание: src/features/<раздел>/CLAUDE.md` в первых 20 строках. Правишь
  такой модуль — правишь то описание: сторож описаний требует именно его
  (`scripts/checks/docs.mjs`), а сверка блоков краснеет на указателе в никуда.
  Модуль переехал в свой домен — указатель удаляется.
- **Общие сигнатуры не ломать — расширять можно.** Функции `cards`, `fsrs`,
  `wordPool`, `contextDict`/`dictionary`, `speech`, `activity`, `profile`
  зовут разные разделы; кто именно — блок «Кто использует» ниже и
  `node scripts/arch-map.mjs`.
- **`text.ts` парный к SQL `norm_typed`** — урок «Сверка ответа
  продублирована» в корневом `CLAUDE.md`.
- **Сбой при чтении — исключение, а не «пусто»** (PLAN.md Ф1.13). Функция,
  которая при ошибке отдаёт `null`/`[]`/`0`, лишает экран возможности
  сказать «нет связи» — так Главная рисовала «серию 0», «Квесты» — «пока
  нет», «Диалог» — пустой чат. Переделаны `loadProfile`, `getMyDailyPlanConfig`,
  `loadLastChat`; `listMyQuests` берёт пользователя из сессии на устройстве
  (`currentUserId`), а не `auth.getUser()` — тот ходит в сеть. Новое так же.
- **В базу из `lib/` ходят через единственный клиент** `shared/api/supabase`;
  ошибки — через `dbError` (`src/shared/CLAUDE.md`). Новые модули с базой
  пишутся сразу в `domains/<имя>/api.ts` (архитектура §1–2), не сюда.

## Как проверить

- `npm test` — чистые тесты модулей: `test-answermatches`, `test-wordpool`,
  `test-distractors`, `test-dailyplan`, `test-dynamics`, `test-cefr`,
  `test-assignment-score`, `test-fsrs-graduation` и другие `test-*.mjs`.
- `node scripts/check-answermatches-sql.mjs` (вне CI, база) — клиент и SQL
  сверяют ответы одинаково.

<!-- generated:start -->
<!-- Пишет `npm run gen:docs` (scripts/gen/module-docs.mjs) по коду — руками не править. -->
## Из кода (сгенерировано)

- **Файлы:** `access.ts`, `activity.ts`, `admin.ts`, `aiHealth.ts`, `analytics.ts`, `analyze.ts`, `assignmentScore.ts`, `cards.ts`, `cefr.ts`, `chatHistory.ts`, `contextDict.ts`, `correctionRules.ts`, `dailyPlan.ts`, `dailyPlanCore.ts`, `definitions.ts`, `diagnostics.ts`, `dictionary.ts`, `distractors.ts`, `dynamics.ts`, `errorLog.ts`, `esLevel.ts`, `explain.ts`, `fsrs.ts`, `gameMisses.ts`, `level.ts`, `materials.ts`, `mistakes.ts`, `myTexts.ts`, `onboarding.ts`, `pendingRole.ts`, `phrase.ts`, `pickRound.ts`, `placement.ts`, `profile.ts`, `quests.ts`, `random.ts`, `recentWords.ts`, `settings.ts`, `speech.ts`, `studyPlan.ts`, `teacher.ts`, `text.ts`, `textAnalysis.ts`, `textAnalysisCache.ts`, `textChunks.ts`, `transcribe.ts`, `useChatList.ts`, `useCountUp.ts`, `useKeyboardInset.ts`, `useScrollTop.ts`, `verbMistakes.ts`, `wordPool.ts`, `writing.ts`
- **Описаны в другом модуле (указатель «Описание:»):** `activityDays.ts → features/teacher`, `billing.ts → features/billing`, `diagnosticsBrief.ts → features/teacher`, `feedback.ts → components`, `guided.ts → features/dashboard`, `homework.ts → features/homework`, `homeworkLinks.ts → features/homework`, `homeworkRules.ts → features/homework`, `homeworkSuggest.ts → features/homework`, `homeworkView.ts → features/homework`, `materialExercises.ts → features/teacher`, `passwordReset.ts → features/auth`, `selfCorrect.ts → components`, `studentSignals.ts → features/teacher`, `wordChecks.ts → features/teacher`, `wordPacks.ts → features/flashcards`, `writingGrade.ts → features/writing`
- **Таблицы:** `activity_log`, `cards`, `conversations`, `deck_assignments`, `decks`, `grammar_mistakes`, `grammar_quests`, `material_assignments`, `materials`, `messages`, `placement_requests`, `profiles`, `review_states`, `study_plans`, `teacher_students`, `writing_task_assignments`, `writing_tasks`
- **RPC:** `admin_feedback`, `admin_find_user`, `admin_recent_errors`, `admin_set_plan`, `assign_grammar_quest`, `assign_material`, `assign_placement`, `assign_words_to_student`, `assign_writing_task`, `become_teacher`, `cancel_placement`, `delete_grammar_quest`, `ensure_invite_code`, `finish_material_review`, `finish_writing_review`, `join_teacher`, `log_activity`, `quest_correct_answer`, `reassign_material`, `reassign_writing`, `regenerate_invite_code`, `replace_study_plan`, `save_material_ai_review`, `save_quest_messages`, `self_assign_material`, `set_daily_plan`, `set_student_seat`, `start_own_writing`, `stop_teaching`, `submit_material`, `submit_placement`, `submit_writing`, `teacher_delete_student_cards`, `track_event`, `unassign_material`, `unassign_writing_task`
- **AI-задачи:** `analyze`, `definition`, `material`, `program`, `review`, `word`
- **localStorage:** `recall.aiFails`, `recall.anon_id`, `recall.attr`, `recall.chunk_reload_at`, `recall.definitions`, `recall.en_level_cache`, `recall.es_level`, `recall.game_misses`, `recall.lang`, `recall.onboarded`, `recall.pending_role`, `recall.recent_words`, `recall.settings`, `recall.word_of_day`
- **Кто использует (импортом):** `app`, `components`, `context`, `features/admin`, `features/auth`, `features/billing`, `features/conversation`, `features/dashboard`, `features/flashcards`, `features/grammar`, `features/homework`, `features/onboarding`, `features/practice`, `features/program`, `features/progress`, `features/pronunciation`, `features/quests`, `features/reader`, `features/settings`, `features/study`, `features/teacher`, `features/words`, `features/writing`
<!-- generated:end -->
