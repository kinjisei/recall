# Recall — Architecture & Contract (источник правды)

> Этот документ — **контракт** для всех воркеров. Любой чат, который пишет код,
> должен сначала прочитать этот файл и строго следовать названиям папок, типам,
> схеме базы и сигнатурам функций. Не изобретать свои названия.

## 1. Что это
PWA-приложение для изучения/поддержания **двух языков: английского и испанского**.
Сейчас — для 2 пользователей (англ. B1 и C1; испанский — с нуля, A1–A2).
Позже — режим «Преподаватель» (учитель назначает колоды ученицам).

Язык интерфейса: русский. Контент: английский и испанский; язык выбирается
переключателем EN/ES в шапке (LanguageContext, localStorage `recall.lang`).

> Обновлено 2026-07-07: в Recall влит контент и функциональность
> Flutter-приложения `d:\projects\spanish` (паки слов A1/A2, тексты, диалоги,
> фразы для произношения). Flutter-код не переносился — только данные и логика.

## 2. Научная основа (почему так)
- **FSRS** (интервальное повторение) — карточки.
- **Active recall** — пользователь произносит/печатает ответ, а не «узнаёт».
- **Comprehensible input (i+1)** — тексты/аудио чуть выше уровня.
- **Output** — говорение и письмо с AI-фидбеком (особенно важно для C1).
- **Слова в контексте**, не списком. Привычка (стрик) важнее фич.

## 3. Финальный стек (всё бесплатно)
| Слой | Технология | Зачем |
|------|-----------|-------|
| Frontend | **Vite + React + TypeScript + Tailwind CSS** | SPA, много примеров у AI |
| PWA | **vite-plugin-pwa** | установка на телефон, офлайн |
| База + Вход | **Supabase** (Postgres + Auth + RLS) | бесплатно, синхронизация |
| AI-прокси | **Vercel Serverless Function** `/api/gemini` | прячет GEMINI_API_KEY |
| Хостинг | **Vercel** | фронт + serverless в одном деплое |
| Озвучка/распознавание | **Web Speech API** (браузер) | бесплатно, без сервера |
| Словарь | **Free Dictionary API** (`dictionaryapi.dev`) | без ключа |
| SRS-алгоритм | **ts-fsrs** (npm, open-source) | реализация FSRS |
| AI-модель | **Gemini Flash** (free tier, 1500/день) | диалог, фидбек, генерация |

**Важно:** Gemini-ключ НИКОГДА не в коде фронта. Только в env-переменной Vercel,
доступен только из `/api/gemini`. Фронт зовёт свой `/api/gemini`, не Google напрямую.

## 4. Структура папок (строго соблюдать)
```
recall-app/
  docs/ARCHITECTURE.md        <- этот файл
  api/
    gemini.ts                 <- Vercel serverless: прокси к Gemini (Worker 4)
  src/
    main.tsx
    App.tsx                   <- роутинг
    lib/
      supabase.ts             <- клиент Supabase (Foundation)
      fsrs.ts                 <- обёртка над ts-fsrs (Worker 1)
      dictionary.ts           <- Free Dictionary API, только EN (Worker 2)
      spanishDict.ts          <- перевод исп. слов: локальные паки -> Gemini
      esLevel.ts              <- уровень испанского (placement) в localStorage
      speech.ts               <- Web Speech API: TTS+STT, en-US/es-ES (Worker 3)
      gemini.ts               <- вызов нашего /api/gemini (Worker 4)
      cards.ts                <- addCard(), getDefaultDeck(lang), addCardsBulk()
      activity.ts             <- activity_log: стрик и «сделано сегодня» (Фаза 3)
    types/
      index.ts                <- ВСЕ общие TS-типы (Foundation)
    context/
      AuthContext.tsx         <- вход/выход
      LanguageContext.tsx     <- язык изучения EN/ES (localStorage recall.lang)
    data/
      spanish/                <- контент из приложения spanish:
                                 index.ts — readings, dialogues, sentences (eager);
                                 words.ts + words/*.json — ВЕСЬ словарь (~4668 слов,
                                 ~281 тема, A1–B2), ЛЕНИВО (dynamic import);
                                 grammar.ts + grammar/*.json — 74 урока A1–B2, ЛЕНИВО;
                                 conjugation.ts (+ conjugation_reference/endings_trainer
                                 .json) — справочник времён + тренажёр окончаний, ЛЕНИВО
    components/               <- общие UI (Button, Card, Layout c шапкой EN/ES, Nav)
    features/
      dashboard/              <- главный экран, стрик, дневная сессия (Foundation+Worker4)
      flashcards/             <- блок «Колода» + PacksSheet (паки исп. слов)
      reader/                 <- блок «Ввод»: EN тексты; ES тексты+диалоги (SpanishReader)
      pronunciation/          <- блок «Произношение», обе речи
      conversation/           <- AI-диалог + проверка письма, EN/ES промпты
      grammar/                <- «Грамматика» (только ES): GrammarPage (2 раздела) —
                                 «Уроки» (теория + упражнения) и «Глаголы»
                                 (ConjugationSection: справочник времён + тренажёр)
      practice/               <- «Практика» (только ES): PracticePage-хаб + 4 мини-игры
                                 (Match, Translation, SentenceBuilder, Listening);
                                 util.ts — shuffle/sample/пул слов
      onboarding/             <- PlacementTest: тест уровня ES (роут /placement)
    components/icons.tsx      <- инлайн-SVG-иконки (Lucide-стиль) для навигации/кнопок
  .env.local                  <- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

Правило изоляции: каждый воркер работает В СВОЕЙ папке `features/*` и в СВОЁМ файле
`lib/*`. Общие вещи (`types/`, `components/`, `lib/supabase.ts`, `lib/cards.ts`)
создаёт Foundation и менять их воркеры не должны без согласования с архитектором.

## 5. Модель данных (Supabase / Postgres)
Все таблицы с RLS: пользователь видит только свои строки (кроме shared-колод в будущем).

```sql
-- профиль (1:1 с auth.users)
profiles(
  id uuid pk references auth.users,
  display_name text,
  level text check (level in ('A2','B1','B2','C1','C2')) default 'B1',
  native_lang text default 'ru',
  role text check (role in ('learner','teacher')) default 'learner',
  created_at timestamptz default now()
)

-- колода карточек. lang: 'en'|'es' — язык колоды (мультиязычность, 2026-07-07).
-- При регистрации триггер создаёт ДВЕ колоды: «Мои слова» (en) и «Mis palabras» (es).
decks(
  id uuid pk default gen_random_uuid(),
  owner_id uuid references profiles(id),
  title text not null,
  description text,
  is_shared boolean default false,
  lang text not null default 'en' check (lang in ('en','es')),
  created_at timestamptz default now()
)

-- карточка (слово/фраза). Контент общий, расписание — отдельно (review_states).
-- Язык карточки определяется колодой (decks.lang).
cards(
  id uuid pk default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade,
  front text not null,            -- слово/фраза EN или ES
  back text,                      -- перевод/определение
  example text,                   -- пример в контексте
  ipa text,                       -- транскрипция
  audio_url text,                 -- ссылка на произношение
  source text check (source in ('manual','reader','ai')) default 'manual',
  created_at timestamptz default now()
)

-- персональное расписание FSRS (на пару пользователь+карточка)
review_states(
  id uuid pk default gen_random_uuid(),
  card_id uuid references cards(id) on delete cascade,
  user_id uuid references profiles(id),
  stability double precision,
  difficulty double precision,
  due timestamptz default now(),
  last_review timestamptz,
  reps int default 0,
  lapses int default 0,
  state text check (state in ('new','learning','review','relearning')) default 'new',
  unique(card_id, user_id)
)

-- материалы для «Ввода» (тексты/аудио)
content_items(
  id uuid pk default gen_random_uuid(),
  level text,                     -- A2..C2
  title text,
  body text,                      -- текст (можно с markdown)
  type text check (type in ('reading','listening')) default 'reading',
  audio_url text,
  source text default 'ai',
  created_at timestamptz default now()
)

-- лог активности (стрик и статистика)
-- уникальный индекс (user_id, day, type): одна строка на день и тип занятия,
-- Фаза 3 делает upsert с инкрементом items_done/duration_sec
activity_log(
  id uuid pk default gen_random_uuid(),
  user_id uuid references profiles(id),
  day date default current_date,
  type text,                      -- 'flashcards'|'reader'|'pronunciation'|'conversation'|'writing'
  items_done int default 0,
  duration_sec int default 0,
  created_at timestamptz default now(),
  unique(user_id, day, type)
)

-- AI-диалоги
conversations(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), started_at timestamptz default now())
messages(id uuid pk default gen_random_uuid(), conversation_id uuid references conversations(id) on delete cascade, role text check(role in('user','assistant','system')), content text, created_at timestamptz default now())

-- проверка письма
writing_submissions(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), prompt text, text text, feedback jsonb, created_at timestamptz default now())

-- Фаза 4: режим «Преподаватель»
-- profiles.invite_code text unique — код-приглашение преподавателя
teacher_students(id uuid pk, teacher_id uuid -> profiles, student_id uuid -> profiles,
  created_at, unique(teacher_id, student_id))   -- связь создаёт RPC join_teacher(code)
deck_assignments(id uuid pk, deck_id uuid -> decks, student_id uuid -> profiles,
  created_at, unique(deck_id, student_id))
-- RLS: ученице назначенные колоды/карточки видны только на чтение; расписание
-- (review_states) у каждой своё. Преподавателю видны профиль и activity_log
-- привязанных учениц. Политики decks<->deck_assignments используют функции
-- security definer (deck_assigned_to, deck_owned_by, is_student_of) — иначе
-- взаимные ссылки политик дают «infinite recursion detected in policy».
```

## 6. Общие TypeScript-типы (`src/types/index.ts`)
Создаёт Foundation. Должны точно отражать таблицы выше. Воркеры импортируют отсюда,
свои дубликаты не плодят. Минимум:
`Profile, Deck, Card, ReviewState, ContentItem, ActivityLog, Conversation, Message, WritingSubmission`,
плюс `CEFRLevel = 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'`, `Rating = 'again'|'hard'|'good'|'easy'`
и `AppLang = 'en'|'es'` (язык изучения).
Испанский контент: `SpanishTopic, SpanishWord, SpanishReading, SpanishDialogue, SpanishSentence`.

## 7. Ключевые общие контракты (сигнатуры — не менять)
> Обновлено 2026-07-07: мультиязычность (EN/ES). Параметры lang необязательные,
> по умолчанию 'en' — старые вызовы работают без изменений.

```ts
// lib/cards.ts  (Foundation + Worker 1)
getDefaultDeck(lang?: AppLang): Promise<Deck>  // колода языка (обе создаются триггером)
getDeckIds(lang: AppLang): Promise<string[]>   // id доступных колод языка (свои + назначенные)
addCard(input: { front: string; back?: string; example?: string;
  ipa?: string; audio_url?: string; deckId?: string;   // без deckId — в колоду по умолчанию
  lang?: AppLang;                                      // язык колоды по умолчанию (без deckId)
  source?: 'manual'|'reader'|'ai' }): Promise<Card>
addCardsBulk(deckId: string, cards: { front; back?; example? }[]): Promise<number>
  // массовое добавление (паки слов); пропускает дубликаты по front, возвращает добавленное

// lib/fsrs.ts  (Worker 1)
interface DueCard { card: Card; state: ReviewState | null }   // state=null — новая карточка
getDueCards(limit?: number, lang?: AppLang): Promise<DueCard[]>
  // новые + просроченные; lang — только карточки колод этого языка
reviewCard(card: Card, existing: ReviewState | null, rating: Rating): Promise<void>
  // записывает оценку в review_states (upsert) и вычисляет следующий показ по FSRS

// lib/dictionary.ts  (Worker 2) — только английский
lookup(word: string): Promise<{ word: string; definition?: string; example?: string;
  ipa?: string; audio_url?: string } | null>

// lib/spanishDict.ts — испанский словарь: локальные паки → Gemini
lookupSpanish(word: string): Promise<{ word: string; translation?: string;
  example?: string; exampleRu?: string } | null>

// lib/speech.ts  (Worker 3)
speak(text: string, opts?: { rate?: number; voice?: string; lang?: AppLang }): void
listen(lang?: AppLang): Promise<{ transcript: string; confidence: number }>  // одно распознавание
isRecognitionSupported(): boolean   // STT есть только в Chrome/Edge
speechLang(lang: AppLang): string   // 'en' -> 'en-US', 'es' -> 'es-ES'
getVoices(lang?: AppLang): SpeechSynthesisVoice[]
scorePronunciation(target: string, spoken: string):
  { percent: number; words: { word: string; ok: boolean }[] }
  // испанская диакритика нормализуется: «cómo» == «como»

// lib/gemini.ts  (Worker 4) — зовёт НАШ /api/gemini, не Google напрямую
chat(messages: ChatTurn[], opts?: { system?: string }): Promise<string>
  // ChatTurn = { role: 'user'|'assistant'|'system'; content: string } (src/types)

// lib/activity.ts  (Фаза 3) — стрик и статистика, день в МЕСТНОМ времени
logActivity(type: ActivityType, itemsDone?, durationSec?): Promise<void>  // не бросает ошибок
getStreak(): Promise<number>                    // дней подряд (вчерашняя серия ещё жива)
getTodayTypes(): Promise<Set<ActivityType>>     // какие занятия сделаны сегодня

// lib/teacher.ts  (Фаза 4) — режим «Преподаватель»
getOrCreateInviteCode(): Promise<string>        // код-приглашение (6 символов)
joinTeacher(code: string): Promise<string>      // ученица вводит код → имя преподавателя
getMyTeachers(): Promise<Profile[]>
getMyStudents(): Promise<StudentInfo[]>         // профиль + стрик + неделя + назначенные колоды
getMyDecks(): Promise<Deck[]>
assignDeck(deckId, studentId) / unassignDeck(deckId, studentId): Promise<void>
```

## 8. Дизайн (минимум для согласованности)
- Мобайл-фёрст. Нижняя навигация: Главная / Колода / Ввод / Речь / Диалог.
- Tailwind. Светлая+тёмная тема. Крупные кнопки (тренировка часто с телефона).
- Один экран = одна задача. Главная = «дневная сессия» + стрик.

## 9. Дорожная карта (фазы)
- **Фаза 0 — Подготовка** (пользователь): аккаунты + установка Node.
- **Фаза 1 — Foundation** (1 воркер, последовательно): скелет проекта, Supabase
  схема+RLS+auth, роутинг, общий layout/навигация, `types/`, `lib/supabase.ts`,
  стаб `lib/cards.ts`, базовые `components/`. Разблокирует всех.
- **Фаза 2 — 4 воркера параллельно**: Колода / Ввод / Произношение / AI.
- **Фаза 3** — дневная сессия + стрик + дашборд, полировка, деплой.
- **Фаза 4** — режим «Преподаватель» (роли, назначение колод, прогресс учениц).

## 10. Распределение воркеров (Фаза 2)
- **Worker 1 — Колода:** `features/flashcards/*`, `lib/fsrs.ts`. FSRS-повторение,
  экран ревью (показ → ответ → оценка again/hard/good/easy), запись в `review_states`.
- **Worker 2 — Ввод:** `features/reader/*`, `lib/dictionary.ts`. Чтение текста,
  тап по слову → словарь → кнопка «в колоду» (зовёт `addCard`).
- **Worker 3 — Произношение:** `features/pronunciation/*`, `lib/speech.ts`.
  Шэдоуинг: озвучка фразы → пользователь повторяет → распознавание → сравнение.
- **Worker 4 — AI:** `api/gemini.ts` (прокси), `lib/gemini.ts`, `features/conversation/*`
  (режимы Чат и Письмо внутри одной вкладки). Диалог с уровневым промптом + проверка письма.
```
