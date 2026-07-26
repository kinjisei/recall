# Журнал находок — баги, оптимизации, улучшения

> Сюда падают находки ВСЕХ аудитов (заходы учебника, ревью, пентесты),
> которые ждут решения владельца. Прочитал → решил → вычеркнул (или перенёс
> в план заходов). Формат: 🔴 важно/опасно · 🟡 стоит сделать · ⚪ по желанию.
> Исправленное переносить в раздел «Закрыто» внизу (с датой).

## Открыто

### Из аудита У2 (учебник, 2026-07-26)

1. 🟡 **Лендинг /teachers не предупреждает о закрытом тесте.** CTA «попробовать
   14 дней» ведёт на /login; посторонний узнаёт о белом списке только упёршись
   в отказ регистрации. Пока регистрация закрыта — добавить пометку на лендинг
   (src/features/landing/TeachersPage.tsx).
2. ⚪ (не код) **Пилот спланирован, но не запущен**: скрипт сообщения
   репетиторам (docs/tg-launch.md) и бартер на 3 места (monetization-draft)
   готовы. Действие владельца: отправить сообщения, добавить 2–3 репетиторов
   в белый список. Самый дешёвый следующий шаг проверки спроса (глава 2
   учебника).

### Из аудита У3 — типизация и качество (2026-07-26)

3. 🔴 **Supabase-клиент без типа схемы** (src/lib/supabase.ts) — корневая
   системная дыра: все запросы к базе возвращают нетипизированные данные,
   код молча кастует `data as Deck/Card/...` — 31 место в 11 файлах.
   Переименование колонки в БД TypeScript не заметит. Фикс: `supabase gen
   types typescript` + `createClient<Database>(...)`, убрать лишние касты.
4. 🟡 **lib/batchWords.ts пишет ответ AI в базу без структурной валидации**
   (единственное такое место; в materials.ts и studyPlan.ts валидация есть).
   Мусорный ответ Gemini может лечь прямо в карточки пользователя (front/back
   не-строками). Фикс: проверка typeof по образцу studyPlan.sanitize().
5. 🟡 **MaterialsSection.tsx — «бог-файл»: 805 строк, 6 компонентов** (форма →
   план → предпросмотр → детали + список). Резать по существующим границам в
   features/teacher/materials/*. Не баг, но главный очаг будущих регрессий.
   Соседний кандидат: GrammarPage.tsx (589 строк) — менее срочно.
6. ⚪ **Хрупкие non-null `!` на «честном слове»**: DictationMode (`words!` ×4),
   MaterialsSection (`works!`), GameShell (`q.say!`), QuizModes
   (`item.example!`), PronunciationPage (`current!.text`) — компилятор эти
   инварианты не проверяет; при новом паке без поля упадёт в рантайме.
   Заодно: включить `noUncheckedIndexedAccess` в tsconfig (сейчас `arr[i]`
   считается всегда существующим).

### Из аудита У3 — структура и дубли (2026-07-26)

7. 🟡 **src/lib/spanishDict.ts — мёртвый код (103 строки)**: ноль импортов
   (проверено Grep), роль забрал lib/contextDict.ts ещё 2026-07-19, при этом
   файл обновляли при рефакторинге chat() (заход 18). Удалить.
8. 🟡 **Нет общего lib/storage.ts**: паттерн «JSON из localStorage с try/catch»
   переизобретён в 12 файлах (mistakes, gameMisses, verbMistakes, recentWords,
   myTexts, settings, esLevel, onboarding, definitions, studyPlan, batchWords,
   wordPool), поведение при сбое уже неоднородно ({} vs [] vs игнор). Вынести
   readJson/writeJson до появления 13-й копии.
9. ⚪ **localStorage напрямую из компонентов**: ключ `recall.program_seen.*`
   читается в DashboardPage и пишется в ProgramPage без общего хелпера;
   TUTORIAL_KEY в DeckReview. Мелкое нарушение «логика — в lib/*».
10. 🟡 **Мусор в корне репозитория**: «Recall Приложение (standalone).html» НЕ
    покрыт .gitignore (правило только на *.dc.html) и папка handoff/ с
    устаревшим дублем LoginPage.tsx. При случайном `git add -A` уедет в
    историю. Добавить в .gitignore или убрать из корня.

### Из аудита У4 — безопасность БД и клиента (2026-07-26, ключевые подтверждены Opus)

11. 🔴 **Анонимный оракул кодов-приглашений + системная дыра грантов**
    (schema.sql, join_teacher ~строка 1851). ✔ ПОДТВЕРЖДЕНО чтением кода:
    в функции НЕТ проверки `auth.uid() is null`, а `revoke execute from anon`
    стоит только на has_premium_access/has_paid_access. В Postgres право
    вызова функции по умолчанию у PUBLIC (⊇ anon); `grant ... to authenticated`
    его НЕ снимает. Итог: join_teacher зовётся БЕЗ входа и отвечает по-разному
    на верный/неверный код → перебором находятся действующие коды учителей.
    Фикс: (а) первой строкой каждой SD-функции `if auth.uid() is null then
    raise exception 'RECALL_NO_AUTH'; end if;`; (б) системно
    `revoke execute on all functions in schema public from anon;` + точечный
    ре-грант. Закрывает заодно и утечку relationship-хелперов анониму.
12. 🔴 **review_states пишется клиентом целиком** (lib/fsrs.ts:192-211). ✔
    ПОДТВЕРЖДЕНО: браузер сам считает stability/difficulty/due/reps/lapses/
    state и апсертит; RLS проверяет лишь владение. Ученица через DevTools
    ставит всей колоде state='review', lapses=0 → «выучивает» всё мгновенно.
    Бьёт по ПРОДАЮЩЕЙСЯ ценности: диагностика (lapses≥2) и отчёт родителям
    подделываются самой ученицей. Фикс: RPC submit_review(card_id, rating) —
    FSRS считает СЕРВЕР (как submit_material), клиент шлёт только оценку.
13. 🟡 **activity_log: клиент задаёт day и type без ограничений**
    (lib/activity.ts:36,55). ✔ ПОДТВЕРЖДЕНО: day из new Date() браузера, type
    без CHECK. Подделка стрика (задним числом) и «Динамики за месяц»; мусорный
    type тихо портит выборки диагностики. Фикс: RPC log_activity(type) —
    day/time на сервере (current_date/now()); CHECK на type.
14. 🟡 **localStorage без границы между аккаунтами; signOut чистит 1 ключ из ~15**
    (AuthContext → profile.ts clearProfileCaches). ✔ ПОДТВЕРЖДЕНО: переживают
    выход и не содержат user_id — recall.my_texts.* (ЛИЧНЫЕ тексты!),
    es_level, grammar_mistakes.*, verb_mistakes, recentWords, gameMisses,
    word_of_day, onboarded, deck_tutorial_seen. Общее устройство (кейс
    «учитель+ученицы»): B входит после A и видит тексты/уровень/ошибки A.
    Фикс: clearAllLocalCaches() в signOut() (весь набор recall.*) ИЛИ ключи
    с постфиксом .${userId}.
15. 🟡 **materials: нет проверки роли + нет лимита размера** (schema.sql:355,400).
    Политика «own materials» проверяет только teacher_id=auth.uid(), без
    role='teacher'; INSERT не отозван; body/exercises/plan без предела размера
    (соседи ограничены). Любая ученица (learner) вставляет себе мегабайтные
    строки, раздувая общую базу. Фикс: check роли в политику + pg_column_size.
16. 🟡 **study_plans: забыт revoke insert/update/delete** (schema.sql:1402).
    У соседних таблиц (material_assignments, word_checks, grammar_quests,
    placement_requests) revoke есть — у study_plans нет. Значит транзакционная
    replace_study_plan НЕОБЯЗАТЕЛЬНА: прямой UPDATE+INSERT двумя шагами
    возвращает race, который она закрывала. Фикс: revoke по образцу соседей.
17. 🟡 **cards/messages/writing_submissions без лимита длины полей** (schema.sql;
    лимиты живут только в api/gemini.ts — защищают вызов ИИ, не запись в БД).
    Прямой POST в PostgREST с мегабайтными строками раздувает базу («шумный
    сосед»). Фикс дешёвый: CHECK (char_length(...) < N) на колонках.
18. ⚪ **grammar_mistakes: прямая запись без RPC и без лимита строк**
    (schema.sql:1373). topic_id/ex — произвольные int без FK; можно наплодить
    уникальных «ошибок», зашумив диагностику. Низкая срочность (данные свои).

## Закрыто

- ✅ 2026-07-26 — **docs/ARCHITECTURE.md устарел ~наполовину** (находка У2:
  навигация 5 вкладок вместо 4, перевёрнутый редирект /practice↔/flashcards,
  отсутствовали колонки тарифов, монетизация, квесты/программа/диагностика/
  план дня, content_items значилась рабочей). Переписан целиком и синхронизирован
  с кодом; добавлено правило «обновлять в тот же заход, что меняет структуру».
