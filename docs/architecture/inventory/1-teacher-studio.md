# Опись: студия репетитора

> Часть среза кода Recall перед переездом на Strangler Fig. Механическая карта
> (импорты, таблицы, RPC, развилки языка) — `docs/architecture/code-map.md`,
> здесь не пересчитывается, только используется. Область: `src/features/teacher/`
> (24 файла), `src/features/homework/` (1), `src/features/program/` (2) + lib-модули,
> которые их обслуживают. Факты — только из чтения кода, без смоуков и без
> обращения к живой базе.

---

## 1. `TeacherPage.tsx` (937 строк) — экран студии

**Что делает.** Включение роли преподавателя, код-приглашение, список учеников
с сортировкой «кому нужно внимание», карточка ученика (домашка → 3 плашки →
раскрывашки «Ещё»), панель энергии/мест тарифа.

**Функции.** `TeacherPage` (`:51`, роль → `BecomeTeacher`/`TeacherDashboard`);
`TeacherDashboard` (`:153`, вкладки в `useUrlState('tab')` `:156`, ученик в
`useUrlState('student')` `:164`, `load()` `:183` одним `Promise.all` тянет код,
учеников, счётчики «на проверку», домашки всех, тариф); `StudentRow` (`:505`);
`StudentCard` (`:586`, `SECTIONS` `:575` — порядок значим, тест уровня первым);
`Seats` (`:844`), `StudioEnergy` (`:890`).

**Данные.** `lib/teacher` (`getOrCreateInviteCode`, `getMyStudents`,
`becomeTeacher`, `stopTeaching`, `setStudentSeat`, `unlinkStudent`);
`getHomeworkMany` (`lib/homework`); `countSubmittedWorks`/`countSubmittedWriting`;
`getMyPlan` (`lib/billing`); `getStudentDiagnostics` (только 3 плашки карточки).
Пишет исключительно через RPC библиотек ниже, ничего напрямую в таблицы.

**Состояние/загрузка.** `useUrlState` для вкладки/ученика/раздела; сама загрузка
— ручной `useState`+`useEffect`+`load()`, НЕ `useAsyncData`. Диагностика
карточки — свой `useEffect` с `alive`-флагом (`:629-642`), дублирующий по форме
то, что даёт `useAsyncData`.

**Разнобой.** 937 строк на пять разных задач (роль/дашборд/строка/карточка/
панели). Ручная загрузка вместо `useAsyncData`, хотя рядом (`MaterialsSection`,
`QuestSection`, `ProgramSection`) тот же класс задачи решён хуком. `more`+
`section` — два синхронизируемых вручную состояния под одну раскрывашку
(`:619-726`) вместо одного, выводимого из `section !== null`. Сырые цвета:
`bg-amber-400`, `text-amber-950`, `bg-red-950/30`, `text-rose-300`
(`:307,312,386,672,791`) — не `--night-*`.

**Инварианты.** Покрытие тарифом — ДО сортировки, по исходному порядку
привязки (`:408-421`). Раскрытый раздел карточки — один, в `?sec=` (PWA
свайп-назад, `:608-618`). Домашки всех учеников — одним `getHomeworkMany`, тем
же `homework_json`, что и `getHomework` (`:172-174`). `becomeTeacher`/
`stopTeaching` идемпотентны (`:80-119`).

**Проверки.** `smoke-become-teacher.mjs`, `smoke-lost-students.mjs` (13, вне CI);
`test-student-signals.mjs` (21/21, **в CI**, но тестирует `lib/studentSignals`,
не сам компонент). Сам файл юнит-тестами не покрыт.

---

## 2. `TeacherBlock.tsx` (209) — блок на Главной

**Что делает.** Карточка «Преподаватель» на Главной (для учителя) или блок
привязки по коду (для ученика) + плашка «Задания от преподавателя».

**Функции.** `TeacherBlock` (`:34`), `TeacherCard` (`:45`), `AssignmentsNotice`
(`:82`, top/bottom с общим счётчиком от родителя — не дублирует запрос),
`JoinTeacherBlock` (`:132`).

**Данные.** `countSubmittedWorks`, `getMyTeachers`/`joinTeacher`,
`loadAssignmentCounts` (`:17`).

**Разнобой.** Свой ручной `useState`+`useEffect` (`:46-50`, `:140-144`) — тот же
паттерн, что в `TeacherPage`, не `useAsyncData`. `text-emerald-600` (`:177,205`)
— другой оттенок «успеха», чем `emerald-400` в `DiagnosticsSection`.

**Инвариант.** `AssignmentsNotice` считает от родителя, а не сама (`:87-89`).

**Проверки.** Только косвенно через `smoke-features.mjs`/`smoke-navigation.mjs`.

---

## 3. Домашка — 3 экрана + 5 lib-модулей

**Что делает узел.** Единый список «что задано на неделю» у преподавателя и
ученика: срок, счёт, пункты (обычные и «на выбор»), автозачёт сервером.

**Файлы.**
- `HomeworkSection.tsx` (227) — вид у преподавателя: `ItemRow` (`:37`), `StatTiles`
  (`:187`). Грузит `getHomework(studentId)` ручным `useEffect` (`:94-104`).
- `HomeworkComposer.tsx` (360) — сборка: дата, «Подобрать под ученика»
  (`suggestHomework`), правка пунктов, заметка. Шапка файла (`:1-17`) дублирует
  правило «данные считают состав, AI пишет текст» — то же правило, что и в
  `homeworkRules.ts`, упомянуто дважды намеренно.
- `homework/StudentHomework.tsx` (270) — вид ученика: `Variant` (`:50`, переход
  через `homeworkLink`), `PickRow` (`:136`). Своих кнопок «сдать» для измеримых
  пунктов нет — только `AppLink` и галочка для `kind='free'` (`:118-126`).
- `lib/homework.ts` (97) — только сеть (`getHomework`, `createHomework`,
  `getHomeworkMany`, `completeItem`, `chooseItem`), ре-экспортирует
  `homeworkView.ts` (`:27`).
- `lib/homeworkView.ts` (193) — чистые типы/функции без БД (тестируется в node):
  `homeworkRows` (`:85`, группировка пар «на выбор»), `homeworkProgress`
  (`:118`), `dueShort`/`dueLabel` (`:158,173`), `isOverdue` (`:188`).
- `lib/homeworkRules.ts` (536) — константы правил (`NEW_WORDS_PER_DAY_MAX=10`,
  `NEW_WORDS_PER_SESSION=8`, `MAX_ITEMS=6`, `PICK_SIZE=2`, `:38-54`), покрытие
  текста (`pickText` `:243`, `coverage` `:205`), баланс (`missingSides` `:299`),
  базовый набор (`buildBaseline` `:354`), нормализация ЛЮБОГО набора
  (`applyRules` `:463`), счёт «на выбор — один пункт» (`countableItems` `:527`).
- `lib/homeworkSuggest.ts` (305) — `collectFacts` (`:138`), `suggestPrompt`
  (`:200`, явно запрещает модели менять состав `:212-215`), `suggestHomework`
  (`:254`, при отказе AI — `baseline` с `fromAi:false` `:278-283`, при успехе
  `applyRules` прогоняется ЕЩЁ РАЗ над ответом модели `:296-303`).
- `lib/homeworkLinks.ts` (67) — `BY_KIND` (`:27-34`, те же маршруты, что у
  `dailyPlanCore.ts`), `homeworkLink` (`:41`), `KIND_HINT` (`:59`).

**Данные.** Только RPC: `get_homework`, `get_homework_many`, `create_homework`,
`complete_homework_item`, `choose_homework_item` (`docs/schema.sql:3742,3712,
3809,3877`).

**Состояние/загрузка.** `HomeworkSection`/`HomeworkComposer` — ручной
`useEffect`; `StudentHomework` — состояние пропом от `AssignmentsPage`
(там `useAsyncData` с `.catch(() => null)`, `:82-86`).

**Разнобой.** `HomeworkSection`/`HomeworkComposer` не используют
`useAsyncData` при том же классе задачи. Просрочка — `amber-300`, обычный
прогресс — `night-accent`: часть цветов токенизирована, часть нет.

**Инварианты (детально расписаны в CLAUDE.md, здесь — точный адрес в коде).**
Автозачёт — только сервер (`log_activity` + триггеры на
`writing_task_assignments`, `material_assignments`, `grammar_quests`,
`writing_submissions`). `base_count` — `docs/schema.sql:3533`, используется в
`activity_total` (`:3563`) и при выдаче (`:3791-3793`). `pick_group`/
`chosen_at` — схема `:3510-3519`; закрытую группу нельзя переиграть
(`RECALL_CHOICE_DONE`, `:3734`), продублировано в `homeworkRows`
(`homeworkView.ts:101-112`, сделанное побеждает заявленное). Счёт «N из M» —
везде `homeworkProgress` (`homeworkView.ts:118`). Числа правил — константы
`homeworkRules.ts:38-54`, тест сверяет по эффекту, не по значению.

**Проверки.** `smoke-homework.mjs` (37, читает и через RPC, и напрямую из
таблицы), `smoke-homework-ui.mjs` (29/29), `test-homework-suggest.mjs` (62/62,
**в CI**), `smoke-homework-suggest.mjs` (перехват AI, вне CI). `test-student-
signals.mjs` (21/21, **в CI**) покрывает `homeworkView`+`studentSignals` вместе.

---

## 4. Материалы — `MaterialsSection.tsx` + `materials/*` (6 файлов)

**Что делает.** Генерация учебного текста с упражнениями (AI, план→контент,
либо «свой текст»), библиотека, назначение, проверка сданных работ, печать.

**Файлы.** `MaterialsSection.tsx` (239, `Mode` list/form/plan/preview, материал
в `useUrlState('mat')` `:57`, шаги мастера НЕ в адресе — не восстановить
сгенерированный ответ AI по ссылке, `:51-56`); `materials/RequestForm.tsx`
(253, поле «Для кого» `:130-153` передаёт `studentId` в промпт);
`materials/PlanScreen.tsx` (116); `materials/PreviewScreen.tsx` (135);
`materials/MaterialDetail.tsx` (245, подтверждение при снятии начатой работы
`:71-79`); `materials/MaterialsByLevel.tsx` (64); `ReviewScreen.tsx` (287,
`generateAiReview` + правка вердиктов + переназначение); `PrintSheet.tsx`
(105, портал в `body`, белый лист).

**Данные.** `lib/materials.ts` (622) — генерация (`generateMaterialPlan`,
`generateMaterialContent`, `generateExercisesForText`), хранение (прямые
`from('materials')`: `saveMaterial`, `listMyMaterials`, `deleteMaterial`),
назначение через RPC, режим самоучки (`selfAssignMaterial`,
`createSelfMaterial` `:385-407`). Диагностика в промпт — только через
`studentBriefBlock` (общий модуль). Валидация ответа AI —
`lib/materialExercises.ts` (52, `validExercises`, сверка мультимножеств
`words`/`answer` для `order` `:32-47`).

**Состояние/загрузка.** `MaterialsSection` — `useAsyncData` дважды (материалы,
сданные работы) ПЛЮС ручной `useEffect` для лимита генераций (`:63-74`) — оба
паттерна в одном компоненте. `MaterialDetail`, `ReviewScreen` — ручные.

**Разнобой.** `PrintSheet.tsx` без токенов `--night-*` вовсе — сознательно
(белая печать, задокументировано). `LETTERS` (`PrintSheet.tsx:14`, буквы для
mcq) не переиспользуется в `ReviewScreen`, где варианты не нумеруются вообще —
два представления одного и того же MCQ.

**Инварианты.** Диагностика в промпт — только `studentBriefBlock`
(`materials.ts:82-87`). Несобираемые упражнения отсеивает `validExercises` до
показа ученику. Балл считает `lib/assignmentScore.ts` (`finalScore` `:77`,
учитель > авто, история `attempts[]` не выпадает из среднего). Снятие
сданной/проверенной работы стирает историю без возврата — обязательное
подтверждение.

**Проверки.** `smoke-material-diagnostics.mjs`, `smoke-assignment-review.mjs`
(вне CI), `test-material-exercises.mjs` (28/28, **в CI**), `smoke-self-material.mjs`.

---

## 5. `WritingSection.tsx` (538) + `lib/writing.ts` (299)

**Что делает.** Задания IELTS (Task2/GT1/Academic1 с графиком) или обычное
эссе: создание, назначение, список, переход в `WritingReviewScreen` (лежит в
`features/writing/`, вне области, но зовётся отсюда).

**Функции.** `WritingSection` (`:56`), `WritingForm` (`:137`, генерация вопроса
и данных графика), `WritingDetail` (`:382`).

**Данные.** `createWritingTask` (прямая вставка, RLS `teacher_id=auth.uid()`),
`assignWritingTask`/`submitWriting`/`finishWritingReview`/`reassignWriting`
(RPC), `startOwnWriting` (RPC, самоучка `:57-72`), `sanitizeChart` (`:206-236`,
жёсткая санитизация данных графика от AI).

**Состояние/загрузка.** `useAsyncData` для списка и назначений (`:58-62,
393-397`) — конвенция ровная.

**Разнобой.** 538 строк объединяют список + форму (ветвление IELTS/regular/
график) + карточку назначения — без разбиения на подпапку, как у
`materials/*`. `LEVELS`/`inputClass` берутся из `materials/shared.ts` (`:33`)
— общий модуль физически лежит внутри чужой подпапки.

**Инвариант.** AI генерирует ДАННЫЕ графика, не картинку; санитизация чисел и
меток обязательна (`writing.ts:225-227`), иначе оси разъедутся.

**Проверки.** `smoke-writing.mjs`, `smoke-own-writing.mjs`,
`smoke-writing-focus.mjs` (23/23, перехват AI) — все вне CI.

---

## 6. `StudentWordsSection.tsx` (291) + `WordPicker.tsx` (489)

**Что делает.** Единственное место про словарь ученика: список со статусом,
выдача (паки/свои колоды), удаление, перепроверка.

**Данные.** `lib/wordChecks.ts` (`getStudentWords`, `assignWordCheck`,
`getWordChecks`, `statusOf` — единое правило статуса, порог 21 день `:48-55`);
`lib/teacher.ts` (`assignWordsToStudent` — в личную колоду ученика `:284-306`;
`deleteStudentCards` — RPC `teacher_delete_student_cards`); `WordPicker`
дополнительно — `lib/wordPacks.ts`, `getMyDecks`/`listDeckCards`.

**Состояние/загрузка.** Оба файла — ручной `useState`+`useEffect`+`reload`
(`StudentWordsSection.tsx:57-69`).

**Разнобой.** `WordPicker` держит СВОЙ локальный переключатель языка (`:59`,
обоснованно в коде `:56-58`), но это одна из ТРЁХ независимых реализаций
одного и того же исключения (см. §9 наблюдений). Удаление — `window.confirm`
в разных формах: через локальный `toDelete`-стейт здесь, напрямую в
`TeacherPage.tsx:226,242,795` и `MaterialDetail.tsx:73,97`.

**Инварианты.** Слова — в личную колоду ученика, не колоду-копию учителя.
`cards.source='teacher'` — происхождение, видно перед удалением. Сверка
дублей — по `front.trim().toLowerCase()` (`WordPicker.tsx:479-481`), финальный
отсев на сервере (`assign_words_to_student`, `docs/schema.sql:3286`).

**Проверки.** `smoke-teacher-words.mjs`.

---

## 7. `QuestSection.tsx` (257) + `lib/quests.ts` (71)

**Что делает.** Назначение AI-квестов по грамматике, список с прогрессом,
просмотр переписки.

**Данные.** Тонкий слой над RPC (`assign_grammar_quest`, `delete_grammar_quest`,
`quest_correct_answer`, `save_quest_messages`) + прямое чтение
`grammar_quests` (RLS для обеих сторон).

**Состояние/загрузка.** `useAsyncData` для списка (`:48-52`) — ровно.

**Разнобой.** `SCENARIOS[0] ?? ''` (`:59`) — защита от
`noUncheckedIndexedAccess`, по признанию комментария не нужная на практике;
такой паттерн встречается по коду многократно вместо решения типом.

**Проверки.** `smoke-quests.mjs`.

---

## 8. Диагностика — `DiagnosticsSection.tsx` (338) + `lib/diagnostics.ts` (215) + `diagnosticsBrief.ts` (97) + `dynamics.ts` (113) + `assignmentScore.ts` (91)

**Что делает.** Карта ученика: слова (FSRS, буксующие), задания (балл +
разбивка по типам), ошибки грамматики по темам, квесты, активность, динамика
«сейчас vs 30 дней назад», кнопка «Отчёт родителям».

**Данные.** `getStudentDiagnostics` (`diagnostics.ts:81`, один `Promise.all` на
5 источников); балл — `assignmentScore.ts` (`finalScore`); динамика —
`dynamics.ts` (`computeDynamics`, чистая, сравнивает два 30-дневных окна);
`diagnosticsBrief`/`studentBriefBlock` — общий абзац для промптов трёх мест
(домашка, программа, материалы).

**Состояние/загрузка.** Ручной `useEffect`, с `preloaded` — карта может прийти
сверху от `TeacherPage`, не дублируя запрос (`:103,115`).

**Разнобой.** Названия тем грамматики — отдельный `useEffect` (`:117-132`)
ПОСЛЕ основной диагностики, динамический `import()` по языку — паттерн,
повторяющийся и в `HomeworkComposer`/`homeworkSuggest.ts`, но реализованный
заново в каждом месте.

**Инварианты.** Плашки карточки = раздел «Диагностика»: одна функция,
`preloaded` передаётся, не считается дважды. `activeDays7` = число в строке
списка (`activityDays.ts`). Отсутствие таблицы `grammar_mistakes` не роняет
карту (`:282-285`, `mistakesAvailable`).

**Проверки.** `smoke-diagnostics.mjs`.

---

## 9. `ReportSheet.tsx` (219)

**Что делает.** Печатный отчёт родителям: динамика, «что получается» (только
подтверждённое данными), «фокус месяца» (мягкая подача слабых мест),
комментарий преподавателя. Портал в `body`, всегда белый лист.

**Разнобой.** `strengths`/`focus` (`:86-133`) — логика формирования текста
прямо в компоненте, а не в отдельном lib-модуле (в отличие от
`homeworkSuggest.ts`/`diagnosticsBrief.ts`, где тот же класс задачи вынесен и
тестируется). Своего теста на эту логику нет.

**Проверки.** Нет отдельной проверки.

---

## 10. `PlacementSection.tsx` (164) + `lib/placement.ts` (89)

**Что делает.** Назначение теста уровня (EN/ES), список назначенных/пройденных.

**Данные.** RPC `assign_placement`/`cancel_placement`, прямое чтение
`placement_requests`; ученик закрывает через `submit_placement` (вызов вне
области — `OnboardingFlow`/`PlacementTest`).

**Состояние/загрузка.** Ручной, ленивая загрузка при первом раскрытии
(`:52-54`).

**Разнобой.** Раскрывашка реализована САМА (`open`/`useState`, `:38,85-93`), а
не через общий `Reveal` (используется в `GuideSection`, `TeacherPage.SECTIONS`)
— то же поведение, третий способ его получить.

**Проверки.** `smoke-placement.mjs`, `smoke-onboarding-placement.mjs`.

---

## 11. Программа — `ProgramSection.tsx` (298) + `features/program/*` (163) + `lib/studyPlan.ts` (217)

**Что делает.** AI составляет программу по неделям (использует диагностику и
каталог уроков грамматики); `PlanView` — общий рендер недель для учителя и
ученика (`/program`).

**Данные.** `generateStudyPlan` (промпт + сводка диагностики), `saveStudyPlan`
→ RPC `replace_study_plan` (архив+вставка одной транзакцией, `:150-153` —
раньше сбой между запросами оставлял ученика без активной программы),
`getActivePlan`/`getMyPlans` — прямые запросы.

**Состояние/загрузка.** `useAsyncData` в обоих экранах — ровная конвенция.

**Разнобой.** `sanitize()` (`studyPlan.ts:59-84`) — санитизация ответа AI,
третья независимая реализация того же правила, что `validExercises` и
`sanitizeChart`.

**Инвариант.** `topicId` — только из каталога уроков (`sanitize`, `:73`),
выдуманный номер отбрасывается.

**Проверки.** `smoke-program.mjs`.

---

## 12. План дня — `DailyPlanSection.tsx` (134) + `lib/dailyPlan.ts` (55) + `lib/dailyPlanCore.ts` (110)

**Что делает.** Настройка учителем, какие пункты ученик видит на Главной
каждый день.

**Данные.** `dailyPlanCore.ts` — чистая `buildTodayPlan` (`:57`, тестируется
`test-dailyplan.mjs`, **в CI**); `dailyPlan.ts` — только сеть
(`getStudentDailyPlan`, `setDailyPlan` → RPC `set_daily_plan`).

**Состояние.** `useAsyncData` + локальный `draft` (`undefined`=не трогали,
`null`=вернуть дефолт) — единственное трёхзначное состояние черновика в узле,
нигде больше не переиспользованное.

**Инвариант.** `words` — исключён из выбора учителя, добавляется всегда
клиентом (`buildTodayPlan:58`) и недоступен для снятия в UI (`:78-81`).

**Проверки.** `test-dailyplan.mjs` (**в CI**, имя теста не совпадает с именем
модуля `dailyPlanCore` — при grep по коду это не всегда очевидно).

---

## 13. `GuideSection.tsx` (88) и `AssignmentsPage.tsx` (523, экран ученика)

`GuideSection` — статическая методичка (`data/teacher-guide.ts`), без БД; лежит
в `features/teacher/`, хотя логически не про ведение учеников — граница папки
шире границы ответственности «студия».

`AssignmentsPage.tsx` (роут `/assignments`) — экран ДОМАШКИ УЧЕНИКА, часть узла
§3 логически, но не физически. Стадия — в `useUrlStates(['a','stage'])`
(`:67`), черновик ответов — в `useRef`, не `useState` (`:103,344-346`, чтобы не
перерисовывать список на каждую букву). 523 строки: список + `ReviewedView`
(`:234`) + `AssignmentRunner` (`:322`) в одном файле — то же укрупнение, что в
`WritingSection`.

**Проверки.** Косвенно `smoke-homework.mjs`, `smoke-homework-ui.mjs`.

---

## 14. Билинг студии — `lib/billing.ts` (136)

Не файл студии, но `TeacherPage` (`Seats`, `StudioEnergy`) и `MaterialsSection`
(остаток генераций) читают `getMyPlan()` напрямую и каждый форматирует одни и
те же поля (`seats`, `gen_limit`, `energy_max`…) по-своему: `TeacherPage.tsx:
896-903` рисует полосу локальной функцией `bar()`, `MaterialsSection.tsx:
207-222` — просто текст. `getMyPlan()` глотает ошибку и возвращает `null`
(`:127-135`) — осознанно, но каждое из трёх мест обрабатывает `null` по-своему.

---

## Как резать при переезде

Независимые куски (можно переносить по отдельности, в порядке возрастания
связности):
1. **Тест уровня** (`PlacementSection`+`lib/placement.ts`) — самый изолированный,
   почти не пересекается с остальными.
2. **План дня** (`DailyPlanSection`+`dailyPlan*`) — чистая логика уже отделена
   (`dailyPlanCore.ts`), перенос ядра тривиален.
3. **AI-квесты** (`QuestSection`+`lib/quests.ts`) — тонкий, минимум зависимостей.
4. **Слова ученика** (`StudentWordsSection`+`WordPicker`) — зависит от
   `lib/wordPacks.ts` (вне области) и `lib/teacher.ts` (см. ниже).
5. **Программа** (`ProgramSection`+`features/program/*`+`studyPlan.ts`) —
   `PlanView.tsx` используется и учеником (`/program`), переносить вместе.
6. **Материалы** и **Письмо** — структурно похожи (заявка→генерация→назначение→
   проверка), но НЕ используют общий код между собой; можно резать параллельно,
   если сперва вынести общее (`materials/shared.ts` используется обоими —
   решить, куда он переезжает, до разрезания).
7. **Диагностика** (`DiagnosticsSection`+`diagnostics.ts`+`diagnosticsBrief.ts`+
   `dynamics.ts`+`assignmentScore.ts`) — переносить последней из «независимых»,
   так как её читают домашка, программа и материалы; смена контракта
   `studentBriefBlock`/`getStudentDiagnostics` затронет все три.
8. **Домашка** (§3, три экрана + пять lib-модулей) — самый связанный узел:
   зависит от диагностики (через `homeworkSuggest.ts`), от материалов/письма/
   квестов/речи (через `homeworkLinks.ts`, автозачёт по триггерам на их
   таблицах) и от `activityDays.ts`/`studentSignals.ts`, которые также питают
   список учеников на `TeacherPage`. Переносить последним, целиком, вместе со
   схемными триггерами.
9. **`TeacherPage.tsx`** зависит от всех перечисленных (собирает карточку
   ученика) — естественный кандидат на самый последний перенос или на полную
   пересборку из уже переехавших кусков.

`lib/teacher.ts` (`getMyStudents`, `assignWordsToStudent`, места/сиденья) —
общий фундамент для §1, §6, используется как читателями списка учеников, так
и выдачей слов; переносить вместе с `activityDays.ts`/`studentSignals.ts`.

---

## Сквозные наблюдения по области

1. **Два конкурирующих способа загрузки данных.** `useAsyncData` — в 7 из 26
   файлов (`MaterialsSection`, `WritingSection`, `QuestSection`,
   `ProgramSection`, `DailyPlanSection`, `AssignmentsPage`, `ProgramPage`);
   остальные ~9 (`TeacherPage`, `TeacherBlock`, `HomeworkSection`,
   `HomeworkComposer`, `DiagnosticsSection`, `PlacementSection`,
   `StudentWordsSection`, `WordPicker`, `ReviewScreen`) вручную повторяют
   `useState`+`useEffect`+`try/catch`+`alive`-флаг.
2. **Раскрывашки — три реализации** одного поведения: общий `Reveal`
   (`GuideSection`, `TeacherPage.SECTIONS`), собственный `open`/`▾▸`
   (`PlacementSection`, `MaterialsByLevel`), смешанный `more`+`section`
   (`TeacherPage.StudentCard`).
3. **Цвет статуса не токенизирован.** 22 из 26 файлов используют сырые классы
   Tailwind (`amber-*`, `red-*`, `emerald-*`, `rose-*`, `sky-*`) вместо
   `--night-*`; оттенок «успех» — то `emerald-400`, то `emerald-600` в соседних
   файлах одного назначения.
4. **Крупные файлы, объединяющие несколько экранов**: `TeacherPage.tsx` (937),
   `AssignmentsPage.tsx` (523), `WritingSection.tsx` (538), `WordPicker.tsx`
   (489), `HomeworkComposer.tsx` (360), `DiagnosticsSection.tsx` (338).
   `MaterialsSection` уже показала рабочий паттерн разбиения на подпапку
   (`materials/*`) — `WritingSection` и `TeacherPage` его не переняли.
5. **Санитизация ответа AI пишется заново под каждый тип данных**:
   `validExercises` (материалы), `sanitizeChart` (график IELTS), `sanitize()`
   в `studyPlan.ts` (программа) — три реализации одного правила «не верь
   ответу модели, проверь форму».
6. **Локальный переключатель языка студии дублирован трижды** независимо:
   `WordPicker.tsx:59`, `ProgramSection.tsx:32`, `QuestSection.tsx:54` — без
   общего компонента/хука.
7. **`materials/shared.ts`** используется и `MaterialsSection`, и
   `WritingSection` — общий модуль лежит внутри подпапки одного из двух
   потребителей, что при разрезании создаст кросс-зависимость.
8. **`homeworkView.ts` — образец правильного разделения** (чистая логика без
   БД ради тестируемости в node); `ReportSheet.tsx` решает тот же класс задачи
   («собрать текст из диагностики») прямо в компоненте, без теста.
9. **Диагностика — единственный узел, где «не считать дважды» реализовано
   последовательно** во всех трёх потребителях (домашка, программа, материалы)
   через `diagnosticsBrief.ts`.
10. **Домашка — единственный узел, полностью описанный в CLAUDE.md.**
    Материалы, письмо, квесты, тест уровня, программа, план дня описаны там
    конспективно; часть их внутренних правил (порядок упражнений
    comprehension→grammar→vocab в `materials.ts:215`, «pie — ровно один ряд» в
    `writing.ts:253-256`) есть только в коде.

---

## Вопросы, которые не удалось прояснить

- Не запускал смоуки и не подключался к базе — не могу подтвердить, что все
  перечисленные RPC реально существуют в текущей базе (только то, что они
  объявлены в `docs/schema.sql`).
- Не читал содержимое `smoke-features.mjs`/`smoke-navigation.mjs` — не знаю,
  насколько подробно они трогают именно студийные экраны или только их
  адресуемость.
- Не нашёл теста на `ReportSheet.tsx`, `TeacherPage.tsx`, `WritingSection.tsx`,
  `AssignmentsPage.tsx` как компоненты — не проверял, упоминаются ли они
  косвенно внутри `smoke-homework-ui.mjs`/`smoke-material-diagnostics.mjs` (не
  читал текст этих скриптов).
- Не оценивал, ломает ли перенос `materials/shared.ts` без `WritingSection.tsx`
  (или наоборот) сборку — зафиксирован только факт общего импорта.
