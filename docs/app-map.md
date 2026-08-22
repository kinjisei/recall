# Recall — карта приложения

> **Зачем этот файл.** Быстрый ответ на вопросы «подключено ли X», «есть ли
> фича Y», «где это лежит», «что ещё не дожато». Не заменяет `ARCHITECTURE.md`
> (контракты/типы), `ACCESS-CONTROL.md` (доступ), `schema.sql` (база) — а
> указывает, где смотреть, и держит инвентарь того, чего в тех файлах нет.
>
> ⚠️ **Меняешь поведение — правь и здесь**, в том же коммите. Устаревшая карта
> вреднее отсутствующей (то же правило, что у `CLAUDE.md`).
>
> Собрано 2026-08-22 (4 воркера по коду + ручная перепроверка ключевых фактов).
> Числа — из файлов на эту дату. «по аудиту» = найдено воркером, при работе над
> пунктом перепроверить.

---

## 1. Стек и интеграции

**Ядро:** Vite + React 19 + TypeScript + Tailwind v4, PWA (`vite-plugin-pwa`),
роутер `react-router-dom` 7. Хостинг — Vercel (автодеплой из `main`).

| Сервис | Подключён | Где | Ключи (имена env) |
|---|---|---|---|
| **Supabase** — Auth, Postgres, RLS, RPC | да | весь `src/lib/*`, `api/_auth.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (только смоуки/сервер), `SUPABASE_ACCESS_TOKEN` (Management API — сверка схемы) |
| **Google Gemini** | да | `api/_core.ts` (`callGemini`/`streamGemini`), `api/gemini.ts` | `GEMINI_API_KEY` (только сервер) |
| **Groq** — chat (фолбэк/lite) + Whisper STT | да | `api/_groq.ts`, `api/_stt.ts`, `api/transcribe.ts` | `GROQ_API_KEY` (только сервер) |
| **Vercel** — хостинг + serverless `api/` + Web Analytics | да | `api/*`, `src/main.tsx` (`@vercel/analytics`, только прод) | настройки в панели Vercel |
| **Free Dictionary API** (dictionaryapi.dev) | да | `src/lib/dictionary.ts` — определения EN по тапу | ключ не нужен |
| **Своя аналитика/логи** (в Supabase) | да | `src/lib/analytics.ts` (`track_event`→`events`), `errorLog.ts`, `feedback.ts` | те же Supabase |
| Onest (шрифт, локально), `vite-plugin-pwa`, `ts-fsrs` | да | `index.css`, `vite.config.ts`, `lib/fsrs.ts` | — |
| `mammoth` (.docx), `pdfjs-dist` (.pdf) — «свои тексты» | да, лениво | `src/lib/myTexts.ts` | — |
| `sharp`, `puppeteer-core` | только dev | `scripts/*` (иконки, смоуки) | — |

**Точно НЕ подключено:** почтовый сервис (Brevo/SendGrid/Resend/Postmark) —
письма идут через **шаблоны Supabase Auth**; платежи (Stripe/Paddle) — **Kaspi
вручную**; мониторинг (Sentry/LogRocket) — своя `errorLog`; сторонняя аналитика
(PostHog/Mixpanel) — своя таблица `events`; Supabase Storage/Realtime — не
используются.

---

## 2. Состояние сервисов (действия владельца, вне кода)

| Что | Состояние |
|---|---|
| Регистрация | **открыта** (`app_settings.registration_open=true`, с 07.08.2026); белый список `allowed_emails` больше не действует |
| **Confirm email** (Supabase Auth) | ⚠️ **НЕ включён** — TODO владельца; код повторной отправки готов (`LoginPage`, `supabase.auth.resend`) |
| Шаблоны писем Supabase (в т.ч. восстановление пароля) | ⚠️ пока стандартные — заменить в панели (`docs/supabase-auth-setup.md`) |
| Бэкап базы (`.github/workflows/backup.yml`) | ✅ работает (пароль в `SUPABASE_DB_URL` починен 22.08.2026) |
| Сторож прода (`canary.yml`) | ✅ 2×/сутки + на каждый деплой; тестит «AI отвечает», письмо при падении |
| Vercel Pro | ⚠️ TODO — Hobby запрещает коммерцию (приём оплаты) |
| Домен, статус ИП | ⚠️ TODO |
| Квоты Google/Groq | помодельные (RPD), цепочка складывает; см. `api/_core.ts`, `docs/energy-design.md` |

---

## 3. Фичи и экраны

Навигация: 4 вкладки — **Главная · Учёба · Практика · Диалог** (`BottomNav`,
`Layout`). Роуты и внутреннее состояние — `react-router-dom` + `lib/useUrlState`.

### Ученик
| Фича | Роут | Что делает | Файлы |
|---|---|---|---|
| Главная | `/` | стрик, энергия, план на сегодня, слово дня, «Начать занятие» | `features/dashboard/DashboardPage` |
| Учёба (хаб) | `/study` | вход в чтение, грамматику, словарь, тест уровня, домашку, квесты, программу | `features/study/StudyPage` |
| Читалка | `/study?view=reader`, `/reader`→`/study` | тексты EN A1–C1 / диалоги ES + свои (PDF/DOCX/TXT), разбор слова по тапу | `features/reader/*` |
| Грамматика | `/grammar` | уроки+упражнения; EN — неправильные/фразовые глаголы; ES — спряжения; «Мои ошибки» | `features/grammar/*` |
| Словарь | `/study?view=words` | паки по уровням, свои слова, FSRS-повторение | `features/words/MyWords`, `flashcards/PacksSheet` |
| Практика (хаб) | `/practice` | повторение FSRS + мини-игры на словах + 3 режима грамматики | `features/practice/PracticePage` |
| Повторение | `/practice?m=review` | свайп-колода по FSRS | `features/flashcards/DeckReview`, `lib/fsrs` |
| Игры слов | `/practice?m=match/gap/translate/listening/sprint/dictation/sentence` | пары, пропуск, перевод, аудирование, спринт, диктант, «собери фразу» | `features/words/*` |
| Грамм-тренажёр | `/practice?m=gr-mcq/gr-fill/gr-order` | выбери/впиши/собери форму | `features/practice/GrammarMixMode` |
| Диалог (хаб) | `/conversation` | чат с AI (**стриминг**) + вкладка «Письмо» | `features/conversation/ConversationPage` |
| Речь (шэдоуинг) | `/pronunciation` | озвучка → запись → оценка (Groq Whisper) | `features/pronunciation/*`, `lib/transcribe` |
| Письмо | `/writing` | задания/свои темы → AI-разбор по критериям **IELTS**, пересдача | `features/writing/*`, `lib/writingGrade` |
| Квесты | `/quests` | AI-квест по грамматике: чат-раннер, CORRECT/TRY_AGAIN | `features/quests/*` |
| Домашка | `/assignments` | единый список на неделю: срок, прогресс внутри пункта, «на выбор» | `features/homework/StudentHomework` |
| Программа | `/program` | план недели от преподавателя | `features/program/*` |
| Прогресс | `/progress` | график 7 дней, стрик, выучено, точность | `features/progress/ProgressPage` |
| Настройки | `/settings` | имя, уровень, скорость озвучки, размер текста, смена пароля, обратная связь, выход | `features/settings/*` |
| Вход/восстановление | `/login`, `/forgot`, `/reset-password` | email+пароль, «забыл пароль» (ссылка+код) | `features/auth/*`, `lib/passwordReset` |
| Онбординг | `/onboarding` | язык → тест уровня → цель → первое занятие | `features/onboarding/*` |

### Студия преподавателя (`/teacher`)
Вкладки: ученики · материалы · письмо · методичка; включение роли `become_teacher`.
| Раздел | Что делает | Файлы |
|---|---|---|
| Ученики | код-приглашение, привязка, места тарифа, сигналы «кому нужно внимание» | `TeacherBlock`, `lib/studentSignals` |
| Домашка | сборка недельного набора (AI подбирает под ученика), автозачёт | `HomeworkSection`, `HomeworkComposer`, `lib/homeworkRules` |
| Материалы | генерация текста с упражнениями под тему/ученика | `MaterialsSection`, `teacher/materials/*` |
| Письмо | проверка работ, правка вердикта AI, история | `WritingSection`, `WritingReviewScreen` |
| Диагностика | карта ошибок (буксующие слова, слабые темы) | `DiagnosticsSection`, `lib/diagnostics` |
| Отчёт родителям | лист на печать | `ReportSheet`, `PrintSheet` |
| Программа / Дневной план / Квесты | планы и AI-квесты ученику | `ProgramSection`, `DailyPlanSection`, `QuestSection` |

### Публичное и админ
Лендинг `/teachers`, тарифы `/pricing`, оферта `/terms`, приватность `/privacy`;
`/admin` (владелец: поиск, тариф вручную, ошибки/feedback с прода).

---

## 4. Контент (числа на 22.08.2026)

**Английский:** 4844 слова (база 3591 + идиомы 911 + B1/B2/C1 по 114), 60 уроков
грамматики, 147 неправильных глаголов, 60 фразовых, 60 фраз речи, 60 вопросов
placement, 28 текстов чтения (`src/features/reader/sampleTexts.ts` — не в `data/`!).
Остальное: `src/data/english/*`.

**Испанский:** 4668 слов, 74 урока грамматики, 14 времён спряжения, 110
упражнений на окончания, 46 текстов, 31 диалог, 135 фраз речи, 60 вопросов
placement. Пути: `src/data/spanish/*`.

Итого ~**9512 слов**. Испанский перенесён из `d:\projects\spanish` (источник,
не трогаем). Паки собираются `lib/wordPacks` (`preparePacks`).

---

## 5. Таблицы БД (источник — `docs/schema.sql`)

`profiles` (профиль, роль, колоночные гранты) · `decks` · `cards` ·
`review_states` (FSRS, пишет клиент) · `activity_log` (1 строка/день/тип) ·
`conversations`+`messages` (чат) · `writing_submissions` ·
`teacher_students` · `deck_assignments` · `materials`+`material_assignments` ·
`word_checks` · `grammar_quests` · `grammar_mistakes` · `study_plans` ·
`homework`+`homework_items` · `ai_calls` (квота) · `events` (аналитика/ошибки/feedback) ·
`allowed_emails` · `app_settings`.
⚠️ `content_items` — есть в схеме и типах, но в коде **не используется** (наследие).

---

## 6. Где что живёт

- `src/lib/` — вся логика вне экранов (~64 файла). Источники правды: `supabase.ts`,
  `profile.ts` (PROFILE_COLUMNS!), `billing.ts`, `fsrs.ts`, `gemini.ts` (клиент,
  `chat`/`chatStream`), `aiHealth.ts` (защита от серии сбоёв), `homework*.ts`,
  `useUrlState.ts`, `text.ts` (`answerMatches` ↔ SQL `norm_typed`).
- `api/` — serverless: `gemini.ts`, `transcribe.ts`, `_core.ts`, `_auth.ts`,
  `_tasks.ts` (задача→модель/квота), `_groq.ts`, `_stt.ts`. Локально их же
  обслуживает `vite.config.ts`.
- `src/features/` — экраны по папкам. `src/components/` — общие (`Sheet`, `Picker`,
  `RowCard`, `BottomNav`, `icons`).
- `scripts/` — смоуки, чистые тесты, аудиты, валидаторы (часть в CI —
  `.github/workflows/checks.yml`).
- `docs/` — `ARCHITECTURE.md`, `ACCESS-CONTROL.md`, `schema.sql`, `energy-design.md`,
  `costs.md`, `mkt/` (маркетинг-ресёрч), `supabase-auth-setup.md`, `work-plan.md`.

---

## 7. Пробелы и полусделанное (вход для блока 2)

Стартовый список для «что улучшить». Помечено, что перепроверено вручную, что —
по аудиту воркера.

| Пробел | Статус | Где | Величина |
|---|---|---|---|
| **Самоудаление аккаунта / экспорт данных** — только письмом | ✅ подтверждено: в UI нет, RPC нет | `LegalPage.tsx:99,207`; нет `delete_account` в схеме | средне |
| **Confirm email не включён** | ✅ TODO владельца (панель), код resend готов | `CLAUDE.md`, `LoginPage` | мелочь |
| **4 шторки глотают причину ошибки** (энергия/сеть) | по аудиту, перепроверить | `AnalysisSheet`, `RoundReview`, `PhraseSheet`, `TextAnalysisSheet` — `.catch(()=>setError)` | полдня |
| **Тексты ошибок квот — на языке «запросов», не ⚡** | по аудиту | `api/_auth.ts` (неск. строк) | полдня |
| **Мёртвая ветка «12 действий/день»** | по аудиту (техдолг) | `api/_auth.ts` (`RECALL_TRIAL_LIMIT`, откат на `consume_ai_quota`) | мелочь |
| **Оценка речи игнорирует порядок слов** (Set) | по аудиту | `lib/speech.ts:90-98` | полдня |
| **ES-уровень и «свои тексты» — только localStorage** (стираются при выходе) | по аудиту | `lib/esLevel.ts`, `lib/myTexts.ts` | полдня |
| **`review_states` подделываются с клиента** | известный остаток (решение принято, код нет) | `lib/fsrs.ts`, `docs/stage3-decisions.md` | день |
| Оферта: старая дата + женский род; схема БД «ученица/вы» | по аудиту | `LegalPage.tsx:16`, `schema.sql` | час/полдня |
| Пустые состояния (тупики после генераций); онбординг без «назад» | по аудиту, мелочь | `MaterialDetail`, `WritingSection`, `OnboardingFlow` | час |
| Годовой тариф отсутствует | по аудиту | `PricingPage` | средне |

**НЕ пробел (воркер ошибся, перепроверено):** «реферальная программа обещана, но
не работает» — на самом деле это **ручной flow через mailto** («привёл коллегу →
напиши → продлим 2 недели», `TeachersPage.tsx:257-269`), честный и в духе ручного
Kaspi. Автоматизации нет намеренно.
