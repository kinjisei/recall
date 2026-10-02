# Опись: AI, речь, письмо

> Не пересчитывает `docs/architecture/code-map.md` — только даёт смысл цифрам
> оттуда. Область: серверные функции `api/*`, экономика энергии в
> `docs/schema.sql`, разделы `conversation`, `pronunciation`, `writing`,
> `quests`, и обвязывающие их `lib/*`.

---

## 1. Серверное ядро AI (`api/`)

### Что делает
Единственная точка, где решается «какой моделью и на чьи деньги» ответить.
Клиент присылает только `task`; сервер сам выбирает уровень модели, цепочку
фолбэков, карман квоты и списывает/возвращает энергию.

### Файлы и функции
- `api/_tasks.ts:34` — `AI_TASKS: Record<AiTask, TaskSpec>`, единственная
  карта «задача → { tier, quota, energyCost, generation?, teacherOnly? }».
  `taskSpec()` (:79) — безопасный разбор имени задачи от клиента (не ведётся
  на `__proto__`).
- `api/_core.ts:38` — `GEMINI_TIER_CHAINS`: цепочки моделей по уровню
  (`lite`/`standard`/`max`), `standard` раздваивается флагом
  `RECALL_CHEAP_MODELS` (:69-71, заготовка перехода на платный Gemini, §6).
  `callGemini()` (:181) — вызов с фолбэками по 429/404, ретраями по 5xx.
  `streamGemini()` (:280) — потоковый вариант для «Диалога» с явным
  контрактом по энергии в комментарии (:265-279).
- `api/_auth.ts:108` — `authorize(req, kind, cost, generation)`: JWT → RPC
  `spend_energy` (фолбэк на `consume_ai_quota`, §7) → маппинг кодов ошибок
  (`RECALL_ENERGY_*`, `RECALL_GEN_LIMIT`, `RECALL_BLOCKED`, :158-267) в
  русский текст. `isTeacher()` (:78) — отдельный запрос к `profiles.role` для
  Pro-задач. `refundAiCall()` (:320) — возврат по `refundToken`, который
  выдаёт только сервер.
- `api/gemini.ts:33` — обработчик `POST /api/gemini`: валидация входа
  (`MAX_MESSAGES`/`MAX_TOTAL_CHARS`, отдельные `*_LITE` — против подмены
  кармана квоты, :24-31), `teacherOnly`-проверка ДО списания (:97),
  `authorize()`, дальше — lite (Groq mini → Gemini-lite), поток
  (`stream && task==='dialog'`, :156-180), либо standard/max с терминальным
  фолбэком на Groq-70b (:182-197).
- `api/transcribe.ts:18` — `POST /api/transcribe`: валидация base64 ДО
  списания `speech`-квоты, `transcribeWithGroq`, тот же `refund`.
- `api/_groq.ts` / `api/_stt.ts` — тонкие клиенты Groq chat и Groq Whisper.
- `vite.config.ts:17-171` — dev-обвязка `/api/gemini` и `/api/transcribe`:
  переиспользует `_core`/`_tasks`/`_groq`/`_stt`, но **заново пишет** роутинг
  без авторизации и квот (см. «Разнобой», п.1).

### Путь данных (полный)
```
клиент (lib/gemini.chat/chatStream) --Bearer JWT, {task, messages, system}-->
  applyCors -> валидация входа (лимиты по task-тиру) -> teacherOnly? isTeacher()
  -> authorize(kind, cost, generation)
       -> RPC spend_energy(p_kind, p_cost, p_generation, p_nonce)
            -> pg_advisory_xact_lock по user -> бан/blocked?
            -> generation? месячный лимит пула (energy_source.gen_limit)
            -> light/speech? суточный анти-абьюз-кэп, 0 энергии
            -> heavy? дневной pool_budget (+ под-кап на аккаунт в студии)
       <- refundToken (nonce, только на сервере)
  -> [lite] Groq mini -> Gemini-lite цепочка
  -> [stream=dialog] streamGemini: первый чанк решает 200 или refund
  -> [standard/max] callGemini(chain) -> (вся цепочка легла) -> Groq-70b
  -> ответ ИЛИ ошибка -> при ошибке/пустом ответе: refundAiCall(nonce)
```

### Таблица «задача → модели → карман»
| task | tier | quota | energyCost | generation | teacherOnly | модели (порядок) |
|---|---|---|---|---|---|---|
| `word`, `definition`, `batch`* | lite | light | 0 | — | — | Groq `llama-3.1-8b-instant` → `gemini-3.5-flash-lite` → `3.1-flash-lite` → `gemma-4-31b-it` → `2.0-flash-lite` |
| `dialog`, `quest`, `analyze` | standard | heavy | 1 | — | — | (free) `3.6-flash`→`3.5-flash`→`2.5-flash`; (`RECALL_CHEAP_MODELS=1`) `2.5-flash`→`3.6-flash`→`3.5-flash`; терминально Groq-70b |
| `writing`, `review` | standard | heavy | 2 | — | — | та же standard-цепочка |
| `material`, `program` | max | heavy | 0 | да (месячный) | да | `2.5-pro`→`3-pro-preview`→`3.6-flash`→`2.5-flash` |
| `homework` | standard | heavy | 0 | да (месячный) | да | standard-цепочка |
| `self_material` | standard | heavy | 0 | да (свой лимит) | нет | standard-цепочка |

\* `batch` объявлена в `AI_TASKS` и в типе `AiTask` (`src/types/index.ts:124`),
но **нигде в клиентском коде не вызывается** — мёртвая задача.

### Экономика (`docs/schema.sql`)
- `ai_calls` (:1052, доращена до полной формы к :2740) — единственный журнал:
  `user_id, kind, cost_energy, pool_owner, is_generation, refund_token,
  called_at`. Пишется только через SQL-функции, клиенту недоступна (`revoke
  all … from anon, authenticated`, :1062).
- `energy_source(uid)` (:2247) — источник дня: своя студия (учитель) → пул
  ученика, покрытого тарифом → свой premium/триал → free (5⚡/0 генераций).
  Тарифные цифры — `teacher_energy_pool`/`teacher_gen_limit` (:2232-2237).
- `spend_energy(p_kind, p_cost, p_generation, p_nonce)` (:2765) — единая точка
  списания: `pg_advisory_xact_lock`, бан/`blocked`, часовой предохранитель
  (40/90/200 в час по классу доступа), три ветки — generation / light-speech /
  heavy (с суб-капом студии `day_budget/2`).
- `refund_ai_call(p_nonce)` (:2843) — удаляет ровно одну строку по
  `refund_token`, окно 10 минут, только свою (`user_id = auth.uid()`).
- `consume_ai_quota(p_kind)` (:1656) — legacy-путь по классам (фиксированные
  дневные лимиты), фолбэк в `authorize()` на случай не залитой миграции. В
  проде не используется, но держится как аварийный путь.
- `ai_usage_overview` (view, :1067) — единственное готовое место, где виден
  расход по пользователям (запросы за час/сутки, последний вызов). Читается
  вручную из SQL Editor — в приложении не отображается.

---

## 2. Раздел «Диалог» (`features/conversation/`)

**Что делает.** Чат с AI-собеседником на изучаемом языке; каждая реплика
ассистента одной структурой разбирает ошибки ученика (`[fix]`/`[ok]`/
`[topic]`) и продолжает разговор. Переписка сохраняется и продолжается на
любом устройстве.

**Файлы.** Один файл, `ConversationPage.tsx` (437 строк). `chatSystemPrompt()`
(:108) — промпт с уровнем/целью/языком; `ChatSection()` (:194) — вся логика:
`send()` (:271, стриминг + `persist()`), `persist()` (:250, время
проставляется ЯВНО на каждую реплику — иначе Postgres `now()` внутри одной
транзакции даёт одинаковый `created_at` и переворачивает пары при чтении).

**Путь данных.** `send()` → `chatStream(history.slice(-20), {task:'dialog',
system}, onChunk)` (`lib/gemini.ts:91`) → `/api/gemini` (`stream:true`) →
чанки в `onChunk` → `setMsgs` растёт на глазах → по завершении `persist()`
пишет `user`+`assistant` в `messages` (свои `created_at`) и
`logActivity('conversation')`.

**Состояние.** `loadLastChat(userId, lang)` (`lib/chatHistory.ts:64`)
поднимает последние 40 реплик последней переписки языка при входе; `startNewChat()`
создаёт пустую запись СРАЗУ по кнопке «Новый диалог» — иначе уход и возврат
поднимали бы уже закрытую переписку. Высота ленты/автоскролл — `useChatList`,
клавиатура — `useKeyboardInset`.

**Стриминг.** Да — единственное место, где `task:'dialog'` реально запрашивает
`stream:true`. Контракт по энергии: ни одного чанка не дошло → сервер уже
вернул энергию; оборвалось после первого чанка → тоже возврат, но частичный
текст уже виден (`api/gemini.ts:170-179`, `lib/gemini.ts:141-145`).

---

## 3. Раздел «Речь» (`features/pronunciation/`)

**Что делает.** Шэдоуинг: слушаешь фразу (Web Speech TTS, бесплатно) →
говоришь в микрофон → Groq Whisper распознаёт → считается совпадение слов.
Первыми в раунде — слова САМОГО ученика (production effect); единственный
экран, вообще не тратящий энергию (класс `speech`, 0 ⚡).

**Файлы.** Один файл, `PronunciationPage.tsx` (502 строки — крупнейший в
области). `recentCardPhrases()` (:66) тянет свежеповторённые карточки
напрямую из `review_states`/`cards`, минуя `lib/cards`. `buildPool()` (:109),
`finishRecording()` (:200: запись → `transcribe()` → `scorePronunciation()`).

**Путь данных.** `onMic()` → `startRecording()` (`lib/transcribe.ts:41`,
MediaRecorder) → `finishRecording()` → `transcribe(blob, lang)`
(`lib/transcribe.ts:103`) → `POST /api/transcribe` → `authorize(req,'speech')`
(0 ⚡, только суточный кэп) → `transcribeWithGroq` (Whisper
`large-v3-turbo`) → `scorePronunciation()` (`lib/speech.ts:90`, чистая функция
без AI). Ни один шаг не идёт через `api/gemini`.

**Состояние.** Раунд из 10 фраз — в `useState`, без сохранения на сервер,
кроме `logActivity('pronunciation')`; сам счёт раунда нигде не пишется.

---

## 4. Раздел «Письмо» (`features/writing/`)

**Что делает.** Два входа: письменные задания преподавателя/себе
(IELTS-критерии или обычный уровень) с историей попыток, и «Быстрая проверка
текста» — свободный текст без темы. Оба тратят `heavy` (2 ⚡: `writing`/`review`).

**Файлы.**
- `WritingPage.tsx` (394) — список (`WritingPage`), раннер (`WritingRunner`,
  :183), выбор темы (`TopicPicker`, :333, темы — статика
  `src/data/writingPrompts.ts`, не AI).
- `QuickWriteCheck.tsx` (150) — свой промпт `writingSystemPrompt()` (:23),
  пишет прямо в `writing_submissions` (минуя RPC).
- `WritingGradeView.tsx` (186) — общий рендер оценки (ученик и преподаватель):
  «Фокус» первым, полный список — под `<details>`.
- `WritingReviewScreen.tsx` (185) — проверка преподавателем: оставить/снять
  правки AI, итоговый балл, «Завершить» или «На доработку».
- `WritingHistory.tsx` (48) — раскрывашка попыток.
- `lib/writing.ts` (299) — CRUD через RPC (`start_own_writing`,
  `submit_writing`, `finish_writing_review`, `reassign_writing`) +
  `generateChartTask()`/`generateIeltsQuestion()` (task `material`,
  teacher-only Pro — данные графика рисует клиент `ChartView`, не картинка).
- `lib/writingGrade.ts` (195) — `gradeWriting()`: режимы `ielts`/`regular`,
  общий `FOCUS_RULE` (:22, ≤3 типа — `MAX_FOCUS`, :19), `parseGrade()` (:41) —
  санитайз JSON модели с потолками (30 ошибок, 3 rewrite, 3×3 фокуса).

**Путь данных.** `WritingRunner.submit()` → `gradeWriting()` → `chat(...,
{task:'writing'})` → `/api/gemini` (без потока) → `parseGrade()` →
`submitWriting()` (RPC) → учитель → `finishWritingReview()` или
`reassignWriting()` (цикл уходит в `attempts`).

**Разбор ошибок — общее правило.** `lib/correctionRules.ts`:
`KEEP_TENSE_RULE`, `NO_INVENTED_MISTAKES_RULE`, `LIST_BEFORE_REWRITE_RULE`
(список ошибок раньше «улучшенной версии»). Продублированы ТЕКСТОМ (не
импортом) в `ConversationPage.chatSystemPrompt()` (:139-140); `QuestsPage` и
`writingGrade.ts` — импортом (см. «Разнобой», п.3).

---

## 5. Раздел «AI-квесты» (`features/quests/`)

**Что делает.** Текстовый квест по грамматике: AI — гейммастер, каждая
реплика ученика получает вердикт первой строкой (`CORRECT`/`TRY_AGAIN`/
`START`), прогресс считает СЕРВЕР (`quest_correct_answer`).

**Файлы.** Один файл, `QuestsPage.tsx` (346). `questSystemPrompt()` (:36) —
формат вердикта + `CORRECTION_RULES` импортом. `parseReply()` (:62) —
регэксп на вердикт. `QuestChat.talk()` (:168) — не потоковый `chat(...,
{task:'quest'})`, при `CORRECT` — `logActivity('quest')` (не `'grammar'` —
иначе задваивался бы план дня) и `questCorrectAnswer()`.

**Путь данных.** `talk()` → `chat()` → `/api/gemini` → `parseReply()` →
`saveQuestMessages()` (RPC, вся переписка в `jsonb`) → `CORRECT` →
`questCorrectAnswer(id)` (RPC, инкремент на сервере — прогресс нельзя
подделать прямой записью).

---

## 6. Общие lib-модули

| Модуль | Роль |
|---|---|
| `lib/gemini.ts` | Единственный клиент `/api/gemini`: `chat()` (:35), `chatStream()` (:91). `isNetworkError` отличает сетевой сбой от серверного — важно для `aiHealth`. |
| `lib/aiHealth.ts` | Счётчик серии СЕРВЕРНЫХ сбоёв за час (localStorage, `LIMIT=3`); сетевые сбои сюда не пишутся. |
| `lib/chatHistory.ts` | Память «Диалога»: `loadLastChat`/`startNewChat`. Двойная сортировка (`created_at` DESC, потом `role` ASC) чинит записи с одинаковым временем пары. |
| `lib/useChatList.ts` / `useKeyboardInset.ts` | Мессенджер-раскладка (Диалог + Квесты): внутренний скролл списка, панель ввода над клавиатурой. |
| `lib/transcribe.ts` | Запись микрофона (MediaRecorder, работает на iPhone) + клиент `/api/transcribe`. |
| `lib/speech.ts` | TTS (Web Speech API, без сервера) и `scorePronunciation()` — чистое сравнение, без AI. |
| `lib/writingGrade.ts`, `lib/correctionRules.ts` | Разобраны в §4. |

---

## Разнобой

1. **Дублирование роутинга AI между прод и dev.** `api/gemini.ts:33-201` и
   `vite.config.ts:17-114` — два независимых обработчика одной логики (lite →
   stream → standard/max), с разной глубиной (dev не проверяет `teacherOnly`,
   входные лимиты, авторизацию). Правка порядка веток в одном месте не
   гарантированно попадёт во второе.
2. **Мёртвая задача `batch`.** В `AiTask` (`src/types/index.ts:124`) и
   `AI_TASKS` (`api/_tasks.ts:38`), тест `test-aitasks.mjs:65-69` ожидает её
   в списке — но ни один клиентский файл не вызывает (`grep "'batch'"` —
   только объявление типа).
3. **Правила разбора ошибок продублированы текстом, не импортом.**
   `ConversationPage.tsx:139-140` — то же содержание, что
   `KEEP_TENSE_RULE`/`NO_INVENTED_MISTAKES_RULE`, но переписано английским
   заново вручную. `QuestsPage.tsx`/`writingGrade.ts` импортируют константу;
   `Conversation` и `QuickWriteCheck.tsx` (:41, свой русский пересказ) — нет.
   Правка формулировки должна руками разойтись по трём местам вместо одного.
4. **Разный уровень обработки ошибок AI на клиенте.** `ConversationPage`
   различает сеть/сервер и трекает `aiHealth`; `QuickWriteCheck` и
   `QuestsPage` в `catch` просто берут `e.message` без различения источника.
5. **`aiOverloaded`/`recordAiServerFailure` подключены только в
   `ConversationPage`.** Письмо, Квесты, Речь не участвуют в общей серии
   сбоёв — баннер «это не ты» может не появиться там, где AI реально падает
   раз за разом, и наоборот.
6. **Компоненты >300 строк:** `PronunciationPage.tsx` (502),
   `ConversationPage.tsx` (437), `WritingPage.tsx` (394), `QuestsPage.tsx`
   (346) — все четыре главных экрана области. `writing/` хотя бы вынес
   `WritingGradeView`/`WritingHistory`/`WritingReviewScreen` отдельно.
7. **Экраны, ходящие в базу мимо `lib/`:** `ConversationPage.tsx` (`messages`
   прямой вставкой), `PronunciationPage.tsx` (`cards`/`review_states`
   напрямую), `QuickWriteCheck.tsx` (`writing_submissions` напрямую) — три из
   восьми таких экранов во всём проекте, все три в этой области.
8. **Legacy-ветки без даты удаления.** Клиент по-прежнему может слать
   `tier`/`provider` (`api/gemini.ts:59-63`, трактуется как `lite`) —
   комментарий говорит «удалить, когда старые клиенты обновятся», условие не
   привязано ни к дате, ни к счётчику обращений.
9. **Два поколения дневных лимитов одновременно.** `consume_ai_quota`
   (:1656, свои жёстко зашитые цифры) держится как fallback рядом с
   `energy_source`/`spend_energy` — если поправить лимиты в одном месте и
   забыть про другое, они разойдутся молча (сработает только при не залитой
   миграции, но код уже сейчас несёт оба набора цифр).

---

## Нагрузка и квоты

**Где сейчас видно расход.** `ai_calls` — полный журнал списаний/возвратов,
но БЕЗ модели, БЕЗ latency, БЕЗ статуса ответа: нельзя понять, что цепочка
`standard` скатилась до Groq-70b или что конкретная модель участилась в
отказах. `ai_usage_overview` (view) — агрегат по пользователю за час/сутки,
только вручную из SQL Editor; в `/admin` не подключено (там только
`admin_funnel` и `get_my_plan`). Логи переключения моделей/429 —
`console.warn`/`error` в `_core.ts`/`_auth.ts`, уходят в Vercel logs, не
агрегируются.

**Чего не хватает для счётчика расхода.** Столбца `model`/`status` в
`ai_calls` (сейчас есть только `kind`/`cost_energy`) — без него нельзя узнать,
на какой модели кончился Free Tier, не читая логи вручную. Дашборда/RPC,
агрегирующего расход по МОДЕЛИ и дню (а не по пользователю) — именно это
нужно, чтобы увидеть приближение к RPD раньше массовых 429. Автоматического
сигнала о росте доли 429/`RECALL_ENERGY_POOL` — сейчас только ручной просмотр
Dashboard раз в месяц-два (`docs/costs.md`).

**Отрепетированный переход на платный Gemini.** Флаг `RECALL_CHEAP_MODELS=1`
(`api/_core.ts:69-71`) готов и переставляет порядок `standard`-цепочки на
«дешёвая первой» — но это переключатель ПОРЯДКА моделей, не тарифа Google.
Сам переход на платный тир — привязка billing к Google Cloud проекту, вне
кода, необратимая для ВСЕХ Gemini-моделей проекта разом (Gemma остаётся
бесплатной) — задокументировано в `docs/costs.md` (§1) вместе с обходным
путём «второй проект с billing». В коде нет автоматического триггера
«RPD исчерпан у всех free → включить платный путь»: переключение — ручной
env на Vercel.

**Лимиты, зашитые в код (`spend_energy`/`energy_source`).** Free: 5 ⚡/день, 0
генераций. Premium: 30 ⚡/день (15 после первых 3 дней триала), 12
генераций/мес самоучке либо 2 пробных учителю без учеников. Студия: пул
40⚡/3 генерации на триале с учениками; на тарифе — 70/110/260 ⚡ и 25/45/90
генераций (Mini/Start/Pro), под-кап ученика — `day_budget/2`. Анти-абьюз
light/speech: 100–900 / 50–400 в сутки по классу доступа; часовой
предохранитель 40/90/200 запросов. Входные лимиты `/api/gemini`: 50
сообщений/40 000 символов (standard), 4/8 000 (lite). `/api/transcribe`:
аудио ≤ 3 МБ.

---

## Инварианты

| Инвариант | Где живёт |
|---|---|
| Клиент шлёт `task`, не модель/tier | `src/types/index.ts:107-120`, `api/_tasks.ts`, `test-aitasks.mjs` |
| `refundToken` неугадываем, выдаётся только сервером | `api/_auth.ts:136-158`, `spend_energy`/`refund_ai_call` (schema.sql:2765-2856) |
| light/speech стоят 0 ⚡, только анти-абьюз-кэп | `api/_tasks.ts:36-38`, `spend_energy` (schema.sql:2811-2818) |
| Не доставили ответ — не берём плату | `api/gemini.ts:106-132`, `streamGemini` (`api/_core.ts:265-279`) |
| Фокусная правка письма ≤3 типов | `lib/writingGrade.ts:19,22` (`MAX_FOCUS`, `FOCUS_RULE`) |
| Не сдвигать время / не выдумывать ошибку | `lib/correctionRules.ts` (продублировано текстом в Диалоге, п.3 Разнобоя) |
| Список ошибок — раньше «улучшенной версии» | `lib/correctionRules.ts:48`, копия в `QuickWriteCheck.tsx:47` |
| Pro-модели (`max`) — только преподавателю | `api/_tasks.ts` (`teacherOnly`), `api/gemini.ts:97-99`, `test-aitasks.mjs:19-24` |
| Прогресс квеста считает сервер | `quest_correct_answer` RPC, `lib/quests.ts:58` |
| Своё слово — первым в тренажёре речи | `PronunciationPage.tsx:52-65` |

---

## Проверки

| Скрипт | Что покрывает | В CI |
|---|---|---|
| `test-aitasks.mjs` | Инварианты `AI_TASKS` (teacherOnly, карман квоты, `taskSpec`) | да |
| `check-api-vercel.mjs` | `api/` компилируется в слабом (Vercel) tsconfig | да |
| `test-ai-health.mjs` | Логика серии сбоёв (`lib/aiHealth`) | да |
| `check-dialog-prompt.mjs` | Промпт «Диалога» на живых моделях | нет |
| `smoke-chat-history.mjs` | Память переписки, сортировка пар реплик | нет |
| `smoke-dialog-stream.mjs` | Потоковый путь `task:'dialog'` | нет |
| `smoke-energy.mjs` | Списание/возврат энергии, коды `RECALL_ENERGY_*` | нет |
| `smoke-quota-seats.mjs` | Покрытие мест тарифа + пул студии | нет |
| `smoke-writing-focus.mjs` | Фокус ≤3, перехват запроса к AI | нет |
| `smoke-writing.mjs`, `smoke-own-writing.mjs` | Путь письма (назначенное/своё) | нет |
| `smoke-quests.mjs` | Вердикт → прогресс → завершение | нет |

Браузерные смоуки требуют dev-сервера и `SUPABASE_SECRET_KEY` — по
`checks.yml` они НЕ в CI (там сборка, `check-api-vercel`, чистые тесты,
валидаторы); запускаются руками. «Сторож прода» (`canary.yml` →
`scripts/canary-prod.mjs`) ходит по живому проду после каждого пуша в
`main`, содержимое не проверялось в рамках этой описи.

---

## Как резать при переезде

- **`api/_core.ts` + `api/_tasks.ts` + `api/_auth.ts`** — резать вместе как
  один «AI-шлюз»: `_tasks` без `_core` не имеет смысла (карта без движка),
  `_auth` без обоих — авторизация без того, что авторизует. `gemini.ts`/
  `transcribe.ts` — тонкие HTTP-адаптеры поверх этого ядра.
- **dev-обвязка `vite.config.ts` — устранить дублирование.** Зафиксировать
  инвариант «dev вызывает ТЕ ЖЕ handler-функции, что и прод» (обернуть mock
  `VercelRequest/Response` вместо второй копии роутинга).
- **`conversation`/`quests` — вынести общую инфраструктуру чата.**
  `useChatList`/`useKeyboardInset` уже общие, но паттерн «переписка + вердикт
  первой строкой» и разметка сообщений скопированы почти дословно — стоит
  выделить как один строительный блок «мессенджер-чат AI» до появления
  третьего такого экрана.
- **`writing/` — образец резки** (View/History/ReviewScreen отдельно) для
  `conversation`/`quests`/`pronunciation`, которые всё ещё монолитны
  (400-500 строк на файл).
- **Экономика (`spend_energy`/`energy_source`/`ai_calls`) — резать отдельно
  от AI-шлюза.** Она уже не зависит от провайдера (Gemini/Groq) и ближе к
  биллингу/тарифам: граница между «AI proxy» и «billing service».
- **`correctionRules.ts` — единственный источник без текстовых копий.** Новый
  AI-чат с исправлением ошибок обязан импортировать константы, а не
  переписывать правило заново (уже разошлось один раз, см. Разнобой п.3).

---

## Сквозные наблюдения

1. Модель выбирает исключительно сервер (`_tasks.ts`) — единственная точка
   правды, не продублированная нигде, кроме честно импортирующей её
   dev-обвязки.
2. `spend_energy` несёт четыре разные политики (бан, generation-лимит,
   light/speech-кэп, heavy-пул) в одном теле на ~90 строк plpgsql без
   разбивки на вспомогательные функции — хорошая граница реза, но крупный кусок.
3. Серия сбоёв AI (`aiHealth`) видна пользователю только в «Диалоге» — из
   четырёх мест, где AI может упасть, три об этом молчат.
4. Три экрана из четырёх в этой области ходят в базу мимо `lib/*` — заметная
   концентрация (у остального проекта таких экранов всего 5 на весь код).
5. Счётчика расхода по МОДЕЛЯМ нет вообще — только по пользователю и классу.
   Переход на платный Gemini будет замечен постфактум, а не по дашборду.
6. Переход на платный Gemini подготовлен частично: порядок моделей — да,
   само подключение billing — ручная необратимая операция вне кода.
7. Промпты дублируются текстом чаще, чем импортом констант.
8. `batch`-задача — мёртвый код именно в самом чувствительном месте (карта
   безопасности AI).
9. Pronunciation (502) и Conversation (437) — один из крупнейших однофайловых
   экранов проекта, при том что сосед `writing/` уже показывает рабочий
   паттерн разбивки.
10. Legacy-путь `tier`/`provider` в `api/gemini.ts` не имеет условия удаления.

## Вопросы, которые не удалось прояснить

- Что именно проверяет `scripts/canary-prod.mjs` по AI-путям — не читался в
  рамках этой описи; раз это единственная проверка на живом проде, важно
  понимать, ловит ли он деградацию Gemini-цепочки.
- Пользуется ли кто-то реально `ai_usage_overview`, или это инструмент,
  который никто не открывает.
- Сознательный задел или забытый код — задача `batch` без единого вызова
  (нужен `git log -p` по `_tasks.ts`/`types/index.ts`, вне бюджета описи).
- Насколько актуальны цифры RPD моделей в комментариях `_core.ts:35-36` —
  сам код просит свериться в AI Studio Dashboard.
