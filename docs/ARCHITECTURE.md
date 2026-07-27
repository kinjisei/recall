# Recall — Architecture & Contract (источник правды)

> Этот документ — **контракт** для всех воркеров. Любой чат, который пишет код,
> должен сначала прочитать этот файл и строго следовать названиям папок, типам,
> схеме базы и сигнатурам функций. Не изобретать свои названия.
>
> ⚠️ ПРАВИЛО АКТУАЛЬНОСТИ: документ обновляется В ТОТ ЖЕ заход, который меняет
> структуру (папки, роуты, таблицы, контракты). Аудит 2026-07-26 показал, что
> отставший чертёж активно вредит: воркеры ломают живой код, доверяя документу.
> Полная синхронизация: 2026-07-26.

## 1. Что это
PWA для изучения **двух языков: английского и испанского** + режим
«Преподаватель» (репетитор ведёт учениц: слова, материалы, программа, квесты,
диагностика). Язык интерфейса русский; язык изучения — переключатель EN/ES
в шапке (LanguageContext, localStorage `recall.lang`).

Статус: в проде (https://recall-pgkz.vercel.app), **закрытый тест** — регистрация
по белому списку `allowed_emails` (открытие — docs/open-registration.sql в день
запуска). Монетизация v1 включена: планы free/premium/teacher_*, триал 14 дней,
оплата вручную (Kaspi → админ). Реальные пользователи: владелец (admin) и
преподаватель (teacher_pro).

## 2. Научная основа (почему так)
- **FSRS** (интервальное повторение) — карточки.
- **Active recall** — пользователь произносит/печатает ответ, а не «узнаёт».
- **Comprehensible input (i+1)** — тексты/аудио чуть выше уровня.
- **Output** — говорение и письмо с AI-фидбеком.
- **Слова в контексте**, не списком. Привычка (стрик) важнее фич.

## 3. Стек (всё бесплатно)
| Слой | Технология | Зачем |
|------|-----------|-------|
| Frontend | **Vite + React 19 + TypeScript + Tailwind v4** | SPA, много примеров у AI |
| PWA | **vite-plugin-pwa** | установка, офлайн; авто-проверка обновлений в main.tsx |
| База + Вход | **Supabase** (Postgres + Auth + RLS) | бесплатно, синхронизация |
| AI-прокси | **Vercel serverless** `/api/gemini`, `/api/transcribe` | ключи только на сервере |
| AI-модели | Каскады Gemini (3.6/3.5-flash, lite, Pro) + Groq (llama, Whisper) | роутинг ПО ТИПУ ЗАДАЧИ — карта `api/_tasks.ts`; клиент модель/уровень НЕ выбирает |
| Квоты AI | RPC `consume_ai_quota(kind)` — классы heavy/light/speech | лимиты по тарифу, защита от выжигания |
| Озвучка (TTS) | **Web Speech API** | бесплатно, en-US / es-ES |
| Распознавание (STT) | MediaRecorder → `/api/transcribe` (**Groq Whisper**) | работает и на iPhone |
| Словарь EN | Free Dictionary API + Gemini(light) | транскрипция/аудио + учебные определения |
| Словарь ES | перевод встроен в паки; контекст — Gemini | `lib/contextDict.ts` |
| SRS | **ts-fsrs** | реализация FSRS |
| Дизайн | Nocturne: тёмная тема, токены `--night-*`, шрифт Onest (локально), иконки Phosphor | `src/index.css`, единая `class="dark"` |
| Хостинг | **Vercel** (автодеплой из main) | фронт + serverless |

**Ключи** (GEMINI_API_KEY, GROQ_API_KEY) — только в env Vercel/`.env.local`
(без VITE_-префикса), фронт зовёт свои /api/*. `/api/*` требуют Supabase-JWT.

## 4. Структура папок (строго соблюдать)
```
recall-app/
  docs/            ARCHITECTURE.md (этот файл), schema.sql (вся БД — источник
                   правды по таблицам), work-plan.md (план заходов),
                   findings.md (журнал находок аудитов), costs.md, textbook/
  api/             gemini.ts, transcribe.ts, _core.ts (вызов моделей + фолбэки),
                   _tasks.ts (карта task→модели/квота/права), _auth.ts (JWT,
                   квота, isTeacher), _stt.ts
  src/
    main.tsx       регистрация SW + автообновление PWA
    App.tsx        роутинг (см. §8)
    types/index.ts ВСЕ общие типы
    context/       AuthContext (вход/выход, кэш профиля), LanguageContext (EN/ES)
    components/    Layout (шапка: BrandLogo, EN/ES, AvatarMenu), BottomNav (4
                   вкладки), Button, Card, RowCard, BackButton(+BackHeader),
                   ProtectedRoute, ErrorBoundary, WordSheet (шторка слова),
                   MarkableText (мультивыбор слов), exercises.tsx (движок
                   упражнений mcq/fill/order — грамматика И материалы),
                   icons.tsx (инлайн-SVG), Confetti, GuidedNext, RoundResult,
                   ScrollToTop, SmartBack, BlockedScreen, LoadError, Brand
    data/
      spanish/     тексты/диалоги/фразы (eager index.ts); ЛЕНИВО: words.ts
                   (~4668 слов A1–B2), grammar.ts (74 урока), conjugation.ts,
                   placement.ts (60 вопросов)
      english/     ЛЕНИВО: words.ts (паки B1-C1 + идиомы + «База уровня» из
                   4000 Essential Words, ~4800 слов), grammar.ts (60 уроков
                   A1–C1), irregular.ts (147 глаголов), phrasal.ts (60 глаголов/
                   476 фраз), placement.ts (60 вопросов); sentences.json (60 фраз
                   «Речи»), sampleTexts.ts
    features/      (по фиче на папку; роуты — §8)
      auth/        LoginPage
      dashboard/   Главная: стрик-герой, план дня, «Начать занятие», слово дня
      study/       ХАБ «Учёба» (/study): тексты → грамматика → слова (паки,
                   +слово, мои слова, повторение) → задания/квесты/программа →
                   тест уровня
      practice/    ХАБ «Практика» (/practice): плитка «Повторение» + мини-игры
                   слов + грамматика (GrammarMixMode: mcq/fill/order) + речь
      words/       мини-игры слов: MatchMode, QuizModes (Пропуск/Перевод/
                   Аудирование), SprintMode, DictationMode, SentenceBuilder,
                   MyWords, AddCardForm, PacksSheet, GameShell, gameUtils
      flashcards/  DeckReview (FSRS-повторение: SwipeCard, WordCheckRunner)
      reader/      читалки: ReaderPage (EN + заголовок-слот), SpanishReader,
                   MyTextsBlock (свои тексты: вставка/PDF/DOCX, localStorage)
      grammar/     GrammarPage (?verbs=1, ?mistakes=1): уроки EN/ES,
                   ConjugationSection (ES), IrregularVerbsSection (EN),
                   PhrasalVerbsSection (EN), повтор ошибок
      pronunciation/ «Речь»: шэдоуинг (TTS → запись → Whisper → оценка %)
      conversation/  «Диалог»: чат + проверка письма (AssistantText, useChatList)
      onboarding/  OnboardingFlow (/onboarding), PlacementTest (/placement)
      quests/      QuestsPage (/quests): чат-раннер AI-квестов ученицы
      program/     ProgramPage (/program), PlanView — программа обучения
      progress/    ProgressPage (/progress): график недели, метрики, выход
      settings/    SettingsPage (/settings): имя, уровень, скорость озвучки,
                   размер текста
      teacher/     TeacherPage (/teacher) + секции по ученице: MaterialsSection,
                   ReviewScreen, QuestSection, ProgramSection,
                   DiagnosticsSection (+ReportSheet — отчёт родителям),
                   DailyPlanSection, PlacementSection, StudentWordsSection,
                   DeckWordsPicker, GuideSection (методичка), PrintSheet (печать)
      billing/     PricingPage (/pricing, публичный)
      admin/       AdminPage (/admin, is_admin): поиск по email, выдача плана
      landing/     TeachersPage (/teachers, публичный лендинг)
      legal/       LegalPage (/privacy, /terms)
    lib/           (по файлу на подсистему; контракты — §7)
  vercel.json      SPA-rewrite (не перекрывает /api/*)
  .env.local       VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, GEMINI_API_KEY,
                   GROQ_API_KEY, SUPABASE_SERVICE_KEY (только для смоуков)
  scripts/         смоуки/аудиты (ux-audit.mjs, smoke-*.mjs, validate-exercises,
                   check-schema.mjs) — создают тестовые аккаунты через service_role
```

Правило изоляции: каждая фича — в своей папке `features/*` + свой файл `lib/*`.
Общие вещи (`types/`, `components/`, `lib/supabase.ts`, `lib/cards.ts`) менять
аккуратно и осознанно.

## 5. Модель данных (Supabase / Postgres)
**Источник правды — docs/schema.sql** (idempotent, заливается целиком; перед
заливкой — `node scripts/check-schema.mjs`). RLS включён на всех таблицах.
Здесь — карта таблиц и ключевые инварианты.

⚠️ **Типы базы для клиента** — `src/lib/database.types.ts` сгенерированы из схемы
(`supabase gen types typescript --project-id <ref>`, токен — SUPABASE_ACCESS_TOKEN
в .env.local). Клиент `createClient<Database>` типизирован ими: расхождение
«код ↔ база» ловится на сборке. **После изменения schema.sql в Supabase —
ПЕРЕГЕНЕРИРОВАТЬ** этот файл, иначе типы разойдутся с реальностью. Запись наших
структур в jsonb-колонки/аргументы RPC — через `toJson()` (lib/supabase.ts).

Ядро:
- `profiles` — 1:1 с auth.users. Базовые: display_name, level (A1..C2),
  native_lang, role ('learner'|'teacher'), created_at. **Плюс колонки фаз 4+:**
  invite_code (unique), blocked, plan ('free'|'premium'|'teacher_mini'|
  'teacher_start'|'teacher_pro'), plan_expires_at, trial_until, is_admin.
  ⚠️ Гранты: UPDATE разрешён только (display_name, level, native_lang);
  SELECT — только безобидные колонки (id, display_name, level, native_lang,
  role, blocked, created_at) — секреты отдают RPC get_my_plan() /
  ensure_invite_code(). `select('*')` на profiles ПАДАЕТ по правам — колонки
  перечислять явно (константа PROFILE_COLUMNS в lib/profile.ts).
- `decks` (owner_id, title, lang 'en'|'es') — при регистрации триггер создаёт
  две колоды (en+es). `cards` (deck_id, front, back, example, ipa, audio_url,
  source) — язык определяется колодой. `review_states` (card_id+user_id unique,
  FSRS-поля) — расписание у каждого своё; with check: только доступная карточка.
- `activity_log` (user_id, day, type, items_done; unique user+day+type) — стрик;
  type: flashcards|reader|pronunciation|conversation|writing|grammar|practice|
  perfect ('perfect' — «идеальный день», не искажает счётчики).
- `conversations`/`messages`, `writing_submissions` — AI-диалог и письмо.
- `content_items` — ⚠️ УСТАРЕЛА, приложением не используется (контент — в
  статических JSON). Не строить на ней.

Преподаватель (Фаза 4+):
- `teacher_students` (+ daily_plan jsonb — план дня ученицы, RPC set_daily_plan)
  — связь создаёт RPC join_teacher(code) с проверкой ЛИМИТА МЕСТ тарифа
  (teacher_seat_limit: mini 5 / start 10 / pro 30, триал 3) под advisory-локом.
- `deck_assignments` — назначение колод; ученице — только чтение.
- `materials` + `material_assignments` (status assigned|submitted|reviewed,
  answers, auto_score/total, ai_review, teacher_review, attempts, note).
- `word_checks` — перепроверка слов; `placement_requests` — просьба пройти тест
  уровня (+ результат учителю); `grammar_quests` — AI-квесты (progress, target,
  messages jsonb); `study_plans` — программа обучения (weeks jsonb, одна
  активная на пару+язык, замена — RPC replace_study_plan).
- `grammar_mistakes` — синк банка «Мои ошибки» (учитель читает у своих учениц).

Монетизация и доступ:
- `allowed_emails` — белый список регистрации (гейт в триггере handle_new_user;
  клиенту невидим полностью).
- `ai_calls` (user_id, kind 'heavy'|'light'|'speech', called_at) — журнал AI;
  пишется только RPC consume_ai_quota(kind): лимиты по тарифу и классу,
  advisory-лок против гонки. Сводка — RPC get_my_plan().

Ключевой инвариант безопасности: **все чувствительные записи — только через
security-definer RPC** (submit_material с серверным пересчётом балла,
finish/reassign/assign_*, quest_*, submit_placement, admin_set_plan...);
прямые insert/update на этих таблицах отозваны (revoke). «Отвязка отбирает
доступ»: политики учителя всюду проверяют is_student_of.

## 6. Общие TypeScript-типы (`src/types/index.ts`)
Воркеры импортируют отсюда, дубликатов не плодят. Ядро:
`Profile, Deck, Card, ReviewState, ActivityLog(+ActivityType), Conversation,
Message, WritingSubmission`, `CEFRLevel = 'A1'..'C2'`, `Rating = 'again'|'hard'|
'good'|'easy'` (UI колоды использует again/good), `AppLang = 'en'|'es'`,
`ChatTurn`, `AiTask = 'word'|'definition'|'batch'|'dialog'|'writing'|'quest'|
'review'|'material'|'program'`.
Контент: `SpanishTopic, SpanishWord, SpanishReading, SpanishDialogue,
SpanishSentence, EnglishWord, WordTopic`, грамматика/упражнения (общие типы
уроков и Exercise для движка components/exercises.tsx).
Преподаватель: `StudentInfo, Material, MaterialAssignment, GrammarQuest,
StudyPlan` и связанные.

## 7. Ключевые общие контракты (сигнатуры — не менять)

```ts
// lib/cards.ts
getDefaultDeck(lang?: AppLang): Promise<Deck>
getDeckIds(lang: AppLang): Promise<string[]>   // свои + назначенные
addCard(input: { front; back?; example?; ipa?; audio_url?; deckId?;
  lang?: AppLang; source?: 'manual'|'reader'|'ai' }): Promise<Card>
addCardsBulk(deckId: string, cards: { front; back?; example? }[]): Promise<number>
listMyWords(lang) / updateCard(id, patch) / deleteCard(id) / countMyWords(lang)

// lib/fsrs.ts
interface DueCard { card: Card; state: ReviewState | null }
getDueCards(limit?: number, lang?: AppLang): Promise<DueCard[]>
reviewCard(card, existing, rating): Promise<ReviewState>  // возвращает НОВОЕ расписание

// lib/dictionary.ts (EN) / lib/contextDict.ts (перевод слова в контексте, EN+ES)
lookup(word) / lookupInContext(word, sentence, lang)

// lib/speech.ts (TTS) — speak(text, {rate?, voice?, lang?}), speechLang, getVoices,
// scorePronunciation(target, spoken) -> { percent, words[] }
// lib/transcribe.ts (STT) — isMicSupported, startRecording, transcribe(blob, lang)

// lib/gemini.ts — зовёт НАШ /api/gemini
chat(messages: ChatTurn[], opts: { task: AiTask; system?: string }): Promise<string>
// Уровень модели, карман квоты и права выбирает СЕРВЕР по task (api/_tasks.ts).
// Клиент модель/tier НЕ задаёт (пентест, заход 18). material/program — только teacher.

// lib/activity.ts — logActivity(type, items?, sec?) (не бросает), getStreak(),
// getTodayTypes()
// lib/level.ts — getUserLevel(lang): ES из localStorage, EN из profiles.level
// lib/profile.ts — fetchProfile (кэш + PROFILE_COLUMNS), getCachedEnLevel,
// clearProfileCaches (звать при signOut)
// lib/billing.ts — getMyPlan() (RPC), paywall-тексты; lib/admin.ts — admin-RPC

// lib/teacher.ts — getOrCreateInviteCode, regenerateInviteCode, joinTeacher(code),
// getMyTeachers, getMyStudents, getMyDecks, assignDeck/unassignDeck,
// listDeckCards, assignSelectedWords (RPC, атомарно)
// lib/materials.ts — generateMaterialPlan/Content (двухшагово), saveMaterial,
// assignMaterial..., submitAssignment (балл пересчитывает СЕРВЕР),
// generateAiReview/finishReview/reassignAssignment
// lib/wordChecks.ts — getStudentWords (+statusOf), assignWordCheck,
// getMyPendingWordChecks, submitWordCheck
// lib/quests.ts — квесты (assign/delete/correctAnswer/saveMessages — всё RPC)
// lib/studyPlan.ts — generateStudyPlan (диагностика+каталог уроков в промпт),
// replace_study_plan (RPC, атомарно); lib/diagnostics.ts — getStudentDiagnostics
// lib/dailyPlan.ts + dailyPlanCore.ts (чистый расчёт плана дня)
// lib/dynamics.ts (динамика за месяц, чистый); lib/assignmentScore.ts (общий балл)
// lib/mistakes.ts — банк «Мои ошибки» (localStorage + тихий синк в БД)
// lib/myTexts.ts — свои тексты (ТОЛЬКО localStorage, лимиты 15к/10шт)
// lib/batchWords.ts — пакетное добавление слов (1 AI-запрос на ~15 слов, lite)
// lib/wordPool.ts / distractors.ts / recentWords.ts / pickRound.ts — материал игр
// lib/guided.ts — ведомая сессия; lib/settings.ts — локальные настройки
// lib/text.ts — answerMatches (варианты через «/»; ЕДИНАЯ проверка ответов —
// та же логика в SQL submit_material)
// lib/storage.ts — readJson/writeJson/readRaw/writeRaw: ЕДИНЫЙ безопасный
// доступ к localStorage (try/catch + fallback). Весь localStorage — через него
// (кроме перечисления ключей в profile.clearUserLocalData).
```

> Безопасность (итог заходов 17–21): RLS защищает от чтения чужого, но не от
> записи «удобных» значений в свою строку — поэтому чувствительные записи только
> через RPC, гранты на колонки, серверный пересчёт баллов, JWT на /api/*,
> сервер сам выбирает модель по task. Вызов RPC анонимом закрыт системно
> (revoke execute … from public + grant … to authenticated, заход 21).
> Осознанные остатки (починить до открытия для ЧУЖИХ учениц, см. findings.md):
> (1) правильные ответы упражнений уходят на клиент (балл серверный, но
> подглядывание возможно); (2) review_states (расписание FSRS) пишется клиентом
> — ученица может подделать собственную диагностику. Оба — про подделку своих же
> данных доверенным пользователем; для платящих чужих нужен серверный расчёт.

## 8. Роуты и дизайн
Роуты: публичные `/login /pricing /teachers /privacy /terms`; под входом:
`/` (Главная) · `/study` (хаб Учёба) · `/practice` (хаб Практика) · `/conversation`
(Диалог) · `/pronunciation` (Речь, вход из Практики) · `/grammar` · `/placement` ·
`/onboarding` · `/quests` · `/program` · `/assignments` · `/progress` · `/settings`
· `/teacher` · `/admin`. Редиректы истории: `/flashcards → /practice`,
`/reader → /study`, `* → /`.

**Нижняя навигация — 4 вкладки: Главная / Учёба / Практика / Диалог**
(«изучаю новое» / «тренируюсь» / «общаюсь»). Шапка: логотип, EN/ES, аватар-меню
(Прогресс, Мои ученицы — для teacher, Настройки, Выйти).

Дизайн: ЕДИНАЯ тёмная тема Nocturne (`class="dark"` на html, токены `--night-*`
в index.css, самый бледный текст `--night-text-25` — только для иконок), шрифт
Onest (@fontsource-variable, офлайн), иконки Phosphor + свои SVG, тач-цели
≥44px, focus-кольца, prefers-reduced-motion, print-стили белые (PrintSheet).
Мобайл-фёрст. Один экран = одна задача.

## 9. История и статус
Фазы 0–4 завершены (фундамент → 4 фичи → стрик/дашборд → преподаватель).
Дальше шли «заходы» (журнал — CLAUDE.md, план — docs/work-plan.md): контент
EN/ES, редизайн Nocturne, монетизация v1, безопасность (ревью+пентест),
AI-квесты, программа обучения, диагностика, план дня, лендинг, юр-страницы.
Сейчас: закрытый тест, пилот с посторонними репетиторами не начат.
Журнал находок аудитов (баги/оптимизации на исправление): **docs/findings.md**.
