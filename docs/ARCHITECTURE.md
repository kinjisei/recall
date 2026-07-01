# Recall — Architecture & Contract (источник правды)

> Этот документ — **контракт** для всех воркеров. Любой чат, который пишет код,
> должен сначала прочитать этот файл и строго следовать названиям папок, типам,
> схеме базы и сигнатурам функций. Не изобретать свои названия.

## 1. Что это
PWA-приложение для изучения/поддержания английского. Сейчас — для 2 пользователей
(B1 и C1). Позже — режим «Преподаватель» (учитель назначает колоды ученицам).

Язык интерфейса: русский. Контент: английский.

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
      dictionary.ts           <- Free Dictionary API (Worker 2)
      speech.ts               <- Web Speech API: TTS+STT (Worker 3)
      gemini.ts               <- вызов нашего /api/gemini (Worker 4)
      cards.ts                <- addCard(), общий хелпер (Foundation, стаб)
    types/
      index.ts                <- ВСЕ общие TS-типы (Foundation)
    components/               <- общие UI (Button, Card, Layout, Nav) (Foundation)
    features/
      dashboard/              <- главный экран, стрик, дневная сессия (Foundation+Worker4)
      flashcards/             <- блок «Колода» (Worker 1)
      reader/                 <- блок «Ввод» (Worker 2)
      pronunciation/          <- блок «Произношение» (Worker 3)
      conversation/           <- AI-диалог (Worker 4)
      writing/                <- проверка письма AI (Worker 4)
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

-- колода карточек
decks(
  id uuid pk default gen_random_uuid(),
  owner_id uuid references profiles(id),
  title text not null,
  description text,
  is_shared boolean default false,
  created_at timestamptz default now()
)

-- карточка (слово/фраза). Контент общий, расписание — отдельно (review_states)
cards(
  id uuid pk default gen_random_uuid(),
  deck_id uuid references decks(id) on delete cascade,
  front text not null,            -- слово/фраза EN
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
activity_log(
  id uuid pk default gen_random_uuid(),
  user_id uuid references profiles(id),
  day date default current_date,
  type text,                      -- 'flashcards'|'reader'|'pronunciation'|'conversation'|'writing'
  items_done int default 0,
  duration_sec int default 0,
  created_at timestamptz default now()
)

-- AI-диалоги
conversations(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), started_at timestamptz default now())
messages(id uuid pk default gen_random_uuid(), conversation_id uuid references conversations(id) on delete cascade, role text check(role in('user','assistant','system')), content text, created_at timestamptz default now())

-- проверка письма
writing_submissions(id uuid pk default gen_random_uuid(), user_id uuid references profiles(id), prompt text, text text, feedback jsonb, created_at timestamptz default now())
```

## 6. Общие TypeScript-типы (`src/types/index.ts`)
Создаёт Foundation. Должны точно отражать таблицы выше. Воркеры импортируют отсюда,
свои дубликаты не плодят. Минимум:
`Profile, Deck, Card, ReviewState, ContentItem, ActivityLog, Conversation, Message, WritingSubmission`,
плюс `CEFRLevel = 'A2'|'B1'|'B2'|'C1'|'C2'` и `Rating = 'again'|'hard'|'good'|'easy'`.

## 7. Ключевые общие контракты (сигнатуры — не менять)
```ts
// lib/cards.ts  (Foundation создаёт стаб, Worker 1 дорабатывает review_states)
addCard(input: { front: string; back?: string; example?: string;
  ipa?: string; audio_url?: string; deckId: string;
  source?: 'manual'|'reader'|'ai' }): Promise<Card>

// lib/fsrs.ts  (Worker 1)
schedule(state: ReviewState, rating: Rating, now?: Date): ReviewState
getDueCards(userId: string): Promise<{ card: Card; state: ReviewState }[]>

// lib/dictionary.ts  (Worker 2)
lookup(word: string): Promise<{ definition?: string; example?: string;
  ipa?: string; audio_url?: string } | null>

// lib/speech.ts  (Worker 3)
speak(text: string, opts?: { rate?: number; voice?: string }): void
listen(): Promise<{ transcript: string; confidence: number }>  // одно распознавание

// lib/gemini.ts  (Worker 4) — зовёт НАШ /api/gemini, не Google напрямую
chat(messages: {role:string;content:string}[], opts?): Promise<string>
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
- **Worker 4 — AI:** `api/gemini.ts` (прокси), `lib/gemini.ts`, `features/conversation/*`,
  `features/writing/*`. Диалог с уровневым промптом + проверка письма (фидбек).
```
