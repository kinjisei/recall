# Опись: каркас приложения и интерфейс

> Область: корень (`main.tsx`, `App.tsx`, `index.html`, `vite.config.ts`,
> `index.css`), `src/components/*`, `src/context/*`, разделы auth / onboarding /
> settings / dashboard / progress / billing / admin / landing / legal, и lib-модули
> инфраструктуры (не фичевые). Числа по всей карте кода — см. `docs/architecture/code-map.md`
> (не пересчитывались). Код не менялся.

## 1. Корень

### `src/main.tsx` (36 строк)
Точка входа. Три вещи ДО первого рендера: `installErrorLogging()`
(`src/main.tsx:16`, ловушки на `window.error`/`unhandledrejection`),
Vercel Web Analytics только в проде (`src/main.tsx:12`), регистрация SW с
ручным `reg.update()` на `visibilitychange` и раз в час (`src/main.tsx:21-30`) —
обход того, что iOS проверяет новую версию PWA только при холодном старте.

### `src/App.tsx` (269 строк)
Все роуты. `<Route>` дерево: публичные (`/login`, `/forgot`, `/reset-password`,
`/privacy`, `/terms`, `/pricing`, `/teachers`) вне `<Layout>`; `/onboarding` —
защищён, но тоже вне `<Layout>` (свои полноэкранные шаги); всё остальное — внутри
`<ProtectedRoute><Layout /></ProtectedRoute>` с `<Outlet>`. Компоненты экранов
берутся ТОЛЬКО из `src/lib/routeChunks.ts` (`App.tsx:23-45`) — комментарий прямо
запрещает параллельный `import()` с тем же путём (иначе прогрев по одному пути
не разогреет реально показанный чанк). Два `<Navigate>`-редиректа переживают
переименование фич: `/flashcards → /practice`, `/reader → /study` (`App.tsx:138-140`).

### `index.html` (19 строк)
`<html class="dark">` — тема прибита на уровне разметки; `theme-color` и
`background` = `#161826` (совпадает с `--night-bg`); `lang="ru"`.

### `vite.config.ts` (246 строк, PWA-часть — `:185-243`)
`VitePWA({registerType:'autoUpdate', injectRegister:false})` — регистрацию SW
делает `main.tsx`, а не плагин. `workbox.globPatterns` кладёт в precache только
каркас (`index-*.js`, `icons-*.js`, `workbox-window*.js` + статика) — раньше
туда попадали ВСЕ чанки (2.39 МБ, включая испанский словарь ученику английского);
языковые чанки кэшируются рантаймом (`StaleWhileRevalidate`, `vite.config.ts:212-219`)
по факту открытия раздела. `manifest.theme_color`/`background_color` = `#161826`,
`display: standalone`. Отдельно в файле (`:1-178`, не в моей области) —
dev-эндпоинты `/api/gemini` и `/api/transcribe`, подменяющие Vercel-функции
локально, включая тот же роутинг задач (`taskSpec`), что и на проде.

### `src/index.css` (356 строк)
Единственная тема — «Nocturne» (тёмная), `@custom-variant dark` оставлен только
как страховка (`index.css:6-11`): комментарий прямо говорит, что паттерн
`bg-X-50 dark:bg-X-900` вычищен и не должен возвращаться.

**Токены (`:root`, `index.css:19-53`):**
- Цвет поверхностей: `--night-bg`, `--night-surface`, `--night-input`,
  `--night-step`, `--night-glass`.
- Текст: `--night-text` + прозрачные производные `-70/-60/-40/-25/-10`
  (числа — итог WCAG-подбора под фон `#161826`, `-25` годится только для
  иконок/рамок при ≥3:1, не для текста — это явно закомментировано).
- Акцент: `--night-accent`, `--night-accent-text`, `--night-accent-900` (подложка),
  `--night-accent-100` (текст на подложке), `--night-accent-45/-30` (прозрачные).
- Шрифт: `--night-font` = `'Onest Variable', 'Onest', system-ui, sans-serif`.
- «Старые» токены `--brand-500/600/700`, `--accent-500` — помечены как временные
  («пока используются неперекрашенными экранами»), но по факту используются и
  в новых местах (`.bg-brand-gradient`, кольцо фокуса `index.css:102`, danger-кнопка).
- **Нет токенов** для danger/warning/success — отсюда системный разнобой (§3).

**Keyframes/классы** (полный список, все определены в этом файле):
`fade-in`/`.animate-fade-in` (только opacity — намеренно без transform,
см. §4 про `<main>`), `ripple`/`.ripple`, `fade-up`/`.animate-fade-up`,
`blob-a/b/c` + `sheen` (аврора экрана входа), `flame`/`.animate-flame`,
`pop-in`/`.animate-pop-in`, `bar-grow`/`.animate-bar-grow`,
`grow-bar`/`.animate-grow-bar`, `pulse-ring`/`.animate-pulse-ring`,
`confetti-fall` (используется инлайн из `Confetti.tsx`, не классом),
`dot-bounce`/`.dot-bounce` (в `Loading`, `Thinking`), `answer-pop`/`.animate-answer-pop`,
`.reveal`/`.reveal[data-open]` (грид-раскрывашка, `Reveal.tsx`), `.lift`
(подъём строк на hover/active), `vt-out-left/in-right/out-right/in-left` +
`.vt-topbar`/`.vt-nav` (View Transitions, см. §4), `@media print` (`.print-sheet`,
`.no-print` — только `PrintSheet` у преподавателя, вне моей области).

## 2. `src/components/*` — общие компоненты (35 файлов)

| Компонент | Что делает | Файл:строка ключевой функции | Прямых импортов (грубая оценка) |
|---|---|---|---|
| `Button` | 4 варианта (primary/secondary/ghost/**danger**), спиннер, ripple на pointerdown | `Button.tsx:51` | 48 |
| `Card` | контейнер-поверхность, `interactive` добавляет `.lift` | `Card.tsx:7` | 40 |
| `Loading` / `RowsSkeleton` | центр-спиннер vs скелетон списка той же высоты | `Loading.tsx:15,41` | 31 |
| `BackButton` / `BackHeader` | квадратная кнопка назад + строка с заголовком, поддержка morph-перехода | `BackButton.tsx:11,30` | 21 |
| `LoadError` | плашка «не удалось загрузить» + повтор, обёртка над `Card`+`Button` | `LoadError.tsx:7` | 14 |
| `RoundResult` / `RoundProgress` / `ScoreGlyph` | единый экран итога раунда (была скопирована в 8 местах) | `RoundResult.tsx:24,81,18` | 13 |
| `AppLink` | `<Link>` с прогревом чанка и View Transition | `AppLink.tsx:36` | 13 |
| `RoundReview` | разбор ответов раунда + «Почему?» (дешёвый AI) | `RoundReview.tsx` | 8 |
| `HowItWorks` | свернутое пояснение «как это работает» — один компонент на все экраны | `HowItWorks.tsx:20` | 8 |
| `Reveal` | CSS-grid раскрывашка, контент монтируется только пока открыто | `Reveal.tsx:14` | 7 |
| `TabPicker` | сегмент-переключатель (`tabs`/`segment`) | `TabPicker.tsx:18` | 6 |
| `SmartBack` / `useSmartBack` | назад для страниц вне `<Layout>` (тарифы, оферта) | `SmartBack.tsx:13,23` | 6 |
| `Picker` | шторка-замена `<select>` (Android иначе рисует светлый нативный) | `Picker.tsx:27` | 6 |
| `Confetti`/`celebrate()` | событийный слой конфетти + вибрация | `Confetti.tsx:20,56` | 5 |
| `Thinking` | «AI думает» — три точки | `Thinking.tsx:14` | 4 |
| `Sheet` | нижняя шторка: портал, drag-to-close, стек для вложенных Escape | `Sheet.tsx:28` | 3 прямых (плюс через `Picker`/`WordSheet`/…) |
| `RowCard` | строка списка: иконка 40px + заголовок + подпись + шеврон/trailing | `RowCard.tsx:30` | 3 прямых (плюс десятки через фичи) |
| `MarkableText` | тап-по-слову в тексте → `WordSheet`/`PhraseSheet`/`TextAnalysisSheet` | `MarkableText.tsx:14` | 3 |
| `GuidedNext` | баннер ведомой сессии «Начать занятие» | `GuidedNext.tsx:24` | 3 |
| `ChartView` | SVG-графики IELTS Task 1 (bar/line/pie/table) без библиотек | `ChartView.tsx` | 3 |
| `Brand` (`BrandMark`/`BrandLogo`) | инлайн-SVG логотип | `Brand.tsx:12,49` | 3 |
| `Layout` / `useFocusMode` | каркас: шапка + `<Outlet>` + нижняя навигация; режим раунда прячет обе | `Layout.tsx:199,191` | 2 |
| `EnergyBar` / `energyLeft()` | полоска остатка энергии ⚡ | `EnergyBar.tsx:14,25` | 2 |
| `WordSheet` / `TappableText` | словарная шторка перевода в контексте | `WordSheet.tsx` | 1 прямой (используется через `MarkableText`) |
| `ScrollToTop`, `ProtectedRoute`, `PageTracker`, `FeedbackSheet`, `ErrorBoundary` | по одному месту подключения (в `App.tsx`/`Layout.tsx`) | — | 1 |
| `BottomNav` | нижняя навигация (не импортируется напрямую фичами — только `Layout.tsx`) | `BottomNav.tsx:67` | 0 прямых кроме `Layout` |
| `TextAnalysisSheet`, `PhraseSheet`, `AnalysisSheet`, `AnalyzedItemsView` | семья «разбора текста»: `MarkableText` держит все три шторки, `AnalyzedItemsView` — общий рендер найденного, используется и `AnalysisSheet`, и `TextAnalysisSheet` | `MarkableText.tsx:9-11` | не импортируются напрямую фичами — только друг другом |
| `BlockedScreen` | экран для `profiles.blocked=true` | `BlockedScreen.tsx` | 1 (`ProtectedRoute.tsx:8`) |
| `useExerciseReview` | хук сбора `ReviewItem[]` для `RoundReview`, общий для раннеров упражнений | `useExerciseReview.ts:12` | — (вне моей области, но общий файл) |

Счётчик «прямых импортов» — грубая оценка по `grep` на `from '.../components/X'`, не точная (не учитывает импорт через компонент-обёртку, напр. `WordSheet`/`PhraseSheet`/`Picker`, реально используемые чаще).

### Иконки — `src/components/icons.tsx` (57 иконок, 215 строк)
Один паттерн: `icon(innerSvgMarkup, strokeWidth?)` → компонент с `viewBox="0 0 24 24"`, `stroke="currentColor"` (`icons.tsx:24-43`). Файл помечен «НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ: перегенерировать из SVG» (`icons.tsx:5`).

- **Самые используемые** (грубый подсчёт вхождений имени, включая совпадения с `*Fill`-вариантами — не идеально точно): `IconSpeaker` (17), `IconCheck` (16), `IconClose` (10), `IconSparkle` (8), `IconRefresh`/`IconCards`/`IconBadgeCheck`/`IconBack` (6-7), `IconSearch`/`IconPencil`/`IconGap`/`IconArrowRight` (6).
- **Неиспользуемые за пределами `icons.tsx`** (0 вхождений): `IconStudents`, `IconSpeechFill`, `IconSpeech`, `IconMicFill` — четыре иконки-сироты (возможно, дубли `IconMic`/`IconTeacher` по смыслу).
- Навигационные пары «обычная / `*Fill`» существуют только для четырёх вкладок BottomNav: `IconHome/Fill`, `IconStudy/Fill`, `IconPractice/Fill`, `IconDialog/Fill` (используется и `IconDialog`/`IconDialogFill` в «Диалоге» для сегмента Чат/Письмо — не в моей области).

### Навигация
- **Вкладки** (`BottomNav.tsx:41-59`): Главная (`/`, also: `/progress /settings /teacher /admin`), Учёба (`/study`, also: `/grammar /placement /assignments /program /quests /writing /self-material`), Практика (`/practice`, also: `/pronunciation`), Диалог (`/conversation`). Активная вкладка подсвечивается и на «своих» внутренних экранах через `also` — без этого список из 4 не покрывал бы связанные роуты (грамматика гасила бы всю навигацию).
- **Скользящая подложка активной вкладки** — есть в коде сейчас (`BottomNav.tsx:89-97`, `transform: translateX(...)`, `transition-[transform,opacity]`). ⚠️ Это противоречит преамбуле `CLAUDE.md`, которая приводит как пример устаревшего утверждения «в навигации скользит индикатор (его нет с редизайна)» — на момент этой описи индикатор в коде ЕСТЬ. Либо документ снова отстал от кода, либо комментарий описывает более раннее состояние другого механизма; стоит уточнить у владельца при следующей правке `CLAUDE.md`.
- Навигация прячется при открытой клавиатуре (`useKeyboardInset()`, `BottomNav.tsx:71-72`).
- Меню профиля (`AvatarMenu` в `Layout.tsx:28-135`): прогресс, вход в режим преподавателя (текст зависит от `profile.role`), тарифы, настройки, отзыв (`FeedbackSheet`), админка (только `is_admin`, видимость — не защита), выход.

## 3. Инвентарь: обход токенов (главный вход для редизайна)

Замер по всему `src/` (не только по моей области — иначе цифры не отвечали бы на вопрос «сколько работы у редизайна»):

- **Сырые hex-цвета** вне `index.css`: 21 вхождение в 6 файлах — `components/Brand.tsx:24,61` (обводка логотипа, `#38366b`), `components/ChartView.tsx:8,155` (палитра графика + белая обводка сегментов), `components/Confetti.tsx:12` (палитра частиц), `features/auth/authUi.tsx:20`, `features/dashboard/DashboardPage.tsx:437`, `features/flashcards/SwipeCard.tsx:138` (три инлайн `radial/linear-gradient` с хардкод-стопами вместо токенов).
- **Сырые tailwind-цвета** (`bg-/text-/border-/…-{red,blue,green,zinc,white,black,…}`): **621** вхождение по всему `src` (только `.tsx`). Топ-15 файлов:
  `teacher/TeacherPage.tsx` (21), `landing/TeachersPage.tsx` (20), `components/exercises.tsx` (20), `dashboard/DashboardPage.tsx` (18), `admin/AdminPage.tsx` (16), `teacher/DiagnosticsSection.tsx` (14), `words/MyWords.tsx` (13), `writing/WritingGradeView.tsx` (12), `teacher/ReportSheet.tsx` (12), `teacher/HomeworkComposer.tsx` (11), `teacher/HomeworkSection.tsx` (10), `onboarding/OnboardingFlow.tsx` (10), `grammar/ConjugationSection.tsx` (10), `words/SentenceBuilder.tsx` (9), `teacher/TeacherBlock.tsx` (9).
  Внутри моей области основной вклад — `onboarding/OnboardingFlow.tsx`, `settings/*`, `dashboard/DashboardPage.tsx`, `admin/AdminPage.tsx`, `auth/*`.
- **Системная дыра — нет токенов danger/warning/success.** 105 вхождений `red-*` в 56 файлах, 21 файл с `amber-*`, 30 файлов с `green-*`/`emerald-*`. Это не только «периферийные» экраны: сам `Button.tsx:20` (`danger: 'bg-red-500/90 text-white hover:bg-red-500'`) и `Sheet.tsx:116` (ручка шторки `bg-slate-600`) — общие компоненты — обходят токены точно так же, как одноразовые экраны. Для редизайна это значит: нужно завести `--night-danger`/`--night-warning`/`--night-success` ДО правки общих компонентов, иначе `Button` variant="danger" останется хардкодом и после переезда токенов.
- **Произвольные пиксельные значения `[Npx]`**: 184 вхождения. Топ-5 файлов: `dashboard/DashboardPage.tsx` (14), `teacher/WordPicker.tsx` (10), `onboarding/OnboardingFlow.tsx` (8), `words/MyWords.tsx` (7), `landing/TeachersPage.tsx` (7).
- **Inline `style` с цветом/фоном**: только 3 файла — `ChartView.tsx` (палитра графика, оправдано — данные, не тема), `dashboard/DashboardPage.tsx:437` (декоративный градиент карточки), `flashcards/SwipeCard.tsx:138` (градиент карты). Немного, но все три — не токенизированы.
- **Отдельная «параллельная» дизайн-система входа.** `features/auth/authUi.tsx` — целиком свой набор примитивов (`inputClass`, `AuroraBg`, `InputGroup`, `PasswordField`, `PrimaryButton`, `EyeIcon`), НЕ использующий `Button`/`Card`/общий `<input>`-стиль. `PrimaryButton` (`authUi.tsx:173-194`) почти дословно дублирует `Button` variant="primary", но отдельным кодом — правка стиля кнопки в одном месте не долетит до входа/восстановления пароля. `LoginPage.tsx` тоже пишет свои `text-red-400`/`text-emerald-400` для ошибок/успеха вместо общих (несуществующих) токенов.
- **Три независимых реализации «назад»**: `BackButton`/`BackHeader` (внутри `<Layout>`), `SmartBack` (страницы вне `<Layout>`), и инлайн-кнопка в `SettingsPage.tsx:104-111` (свой `<button>` с похожим, но не идентичным классом вместо переиспользования одного из двух первых).
- **Настройки — задокументированное исключение, не баг.** Сегмент-переключатели уровня/скорости/размера в `SettingsPage.tsx:131-214` не используют `TabPicker` — это явно оговорено в самом `TabPicker.tsx:7-8` («Чип-переключатели в «Настройках» — отдельный паттерн… сюда не сводятся»), то есть решение принято, а не забыто.

**Анимации по месту использования** (список из `index.css`, см. §1) — используются штатно: `fade-in`/`fade-up` в подавляющем большинстве экранов моей области (Layout, онбординг, настройки, тарифы), `dot-bounce` в `Loading`/`Thinking`, `answer-pop` — не в моей области (экраны упражнений), `blob-*`/`sheen` — только `authUi.tsx` (аврора входа), `confetti-fall` — только `Confetti.tsx` инлайн-стилем (не классом, т.к. параметры анимации у каждой частицы свои).

## 4. Роуты и навигация

Источник: `src/App.tsx` + `src/lib/routeChunks.ts`. Все роуты ленивые (кроме `/login` и `/` — они в стартовом бандле явно, `App.tsx:13-14`).

| Путь | Компонент | Ленивый | Внутри `<Layout>` | Доступ |
|---|---|---|---|---|
| `/login` | `LoginPage` | нет (в бандле) | нет | публичный |
| `/forgot`, `/reset-password` | `ForgotPasswordPage`, `ResetPasswordPage` | да | нет | публичный |
| `/privacy`, `/terms` | `PrivacyPage`, `TermsPage` (один файл `LegalPage.tsx`) | да | нет | публичный |
| `/pricing` | `PricingPage` | да | нет | публичный |
| `/teachers` | `TeachersPage` | да | нет | публичный |
| `/onboarding` | `OnboardingFlow` | да | нет (свой полноэкранный каркас) | вход обязателен, `ProtectedRoute` НЕ гонит уже онбордившихся |
| `/` | `DashboardPage` | нет (в бандле) | да | вход + не заблокирован |
| `/pronunciation`, `/conversation`, `/settings`, `/progress`, `/study`, `/grammar`, `/practice`, `/writing`, `/self-material`, `/quests`, `/program` | соответствующие фичи | да | да | вход + не заблокирован |
| `/placement` | `PlacementTest` | да | да | вход; освобождён от онбординг-гварда (`ProtectedRoute.tsx:99`) |
| `/teacher`, `/assignments` | `TeacherPage`, `AssignmentsPage` | да | да | вход; собственная проверка роли/`?student=` — внутри фичи, не в роутере |
| `/admin` | `AdminPage` | да | да | вход; UI-гейт по `get_my_plan().is_admin` внутри самого компонента (`AdminPage.tsx:47-68`) — не в `ProtectedRoute`, реальная защита на сервере |
| `/flashcards`, `/reader` | `<Navigate>` | — | — | редиректят на `/practice`, `/study` — совместимость старых ссылок |

**Где живёт логика доступа:**
- Вход/блокировка/онбординг — `ProtectedRoute.tsx` (единственное место, применяется ко всему поддереву `<Layout>` и к `/onboarding`).
- Роль teacher/premium/admin — **не в роутере**. `is_admin` проверяется внутри `AdminPage` только для UI (реальный гейт — на сервере, RPC `admin_*` сами проверяют `is_admin`, см. `docs/schema.sql`). Teacher-режим и premium/энергия читаются экранами (`lib/profile`, `lib/billing.getMyPlan()`) там, где нужны — нет единого middleware по ролям.
- `ProtectedRoute` также разруливает подхват отложенной роли учителя (`hasPendingTeacherRole()` из `/login?role=teacher`, `ProtectedRoute.tsx:51-57`) и решение о показе `/onboarding` (`shouldOnboard()` из `lib/onboarding.ts`).

## 5. Разделы `features/*` (моя область)

### `auth/` (4 файла, 941 строка)
Экраны входа/регистрации/восстановления. `LoginPage.tsx` (383) — сама форма +
состояние «письмо отправлено» (`CheckEmail`, повторная отправка с таймером
60 с). `ForgotPasswordPage.tsx` (139) и `ResetPasswordPage.tsx` (225) целиком
построены на правилах из `lib/passwordReset.ts`. `authUi.tsx` (194) — общий низ
для всех трёх («Аврора», поля, кнопка) — см. §3 про разъезд со shared-компонентами.
Развилок по языку нет (эти экраны — до входа, язык ещё не выбран).

### `onboarding/` (2 файла, 731 строка)
`OnboardingFlow.tsx` (460) — 3 шага (язык → уровень/цель → «план готов» с
разветвлением сам/с преподавателем/я преподаватель), написан полностью на
инлайн-Tailwind без `Button`/`Card`. `PlacementTest.tsx` (271) — тест уровня
(до 50/60 вопросов), пишет `profiles` напрямую (в обход `lib/profile.ts` —
единственный экран раздела, ходящий в базу мимо `lib`, см. `code-map.md:145-146`).
7 развилок по языку в `OnboardingFlow`, 3 — в `PlacementTest`.

### `settings/` (3 файла, 541 строка)
`SettingsPage.tsx` (294) — профиль (имя, уровень), локальные настройки речи/чтения,
композиция `SecuritySection` + `DataAccountSection`. `SecuritySection.tsx` (129) —
смена пароля с проверкой текущего (`lib/passwordReset.changePassword`).
`DataAccountSection.tsx` (118, `?? staged` в git status — новый файл) — экспорт
данных (`lib/account.downloadMyData`) и самоудаление с подтверждением вводом
email (`lib/account.deleteMyAccount`). Разнобой: сегмент-переключатели свои
(см. §3), кнопка «Удалить аккаунт» не использует `Button variant="danger"`
(`DataAccountSection.tsx:98` — свой `bg-red-600`).

### `dashboard/` (1 файл, 604 строки)
`DashboardPage.tsx` — Главная. Образцовый пример «одного кадра»: шесть
источников данных собираются одним `Promise.all` (`DashboardPage.tsx:114-…`,
с таймером-страховкой 4с) и рисуются разом, а не по мере прихода — комментарий
явно объясняет, что раньше экран «прыгал». Использует `RowCard`, `Button`,
`EnergyBar`, `HowItWorks` — то есть, в отличие от auth/onboarding, следует общим
компонентам. 3 развилки по языку.

### `progress/` (1 файл, 337 строк)
`ProgressPage.tsx` — «Мой прогресс»: график недели + 4 метрики +
блок «над чем поработать» (для самоучки, те же данные, что видит
преподаватель через `lib/diagnostics`, но под RLS текущего пользователя).
Ходит в `review_states` напрямую (см. `code-map.md:147`).

### `billing/` (1 файл, 186 строк)
`PricingPage.tsx` — публичная страница тарифов из статики `lib/billing.PLANS`,
плюс баннер своего тарифа, если пользователь вошёл. Использует общий `SmartBack`.

### `admin/` (1 файл, 540 строк)
`AdminPage.tsx` — мини-админка владельца: поиск пользователя, включение/продление
тарифа, журнал ошибок с прода (`admin_recent_errors`), лента отзывов
(`admin_feedback`). UI-гейт по `is_admin` из `get_my_plan()` — не защита,
только чтобы не показывать экран не-владельцу (реальная защита — на сервере).

### `landing/` (1 файл, 317 строк) и `legal/` (1 файл, 226 строк)
`TeachersPage.tsx` — публичный лендинг для репетиторов (`/login?role=teacher`
→ `lib/pendingRole`). `LegalPage.tsx` — `/privacy` и `/terms` одним файлом,
общий `Shell`/`H`, дата «Обновлено» как источник правды для споров об оферте.

## 6. lib-модули каркаса

| Модуль | Что делает | Ключевая функция | Особенность |
|---|---|---|---|
| `supabase.ts` | клиент + `currentUserId()` | — | общий для всего приложения, не только моей области |
| `profile.ts` | кэш профиля на сессию, `PROFILE_COLUMNS` | `getProfile`, `selectProfiles` (`profile.ts:48`) | двойной запрос колонок — переживает отставание базы от кода (`profile.ts:38-55`) |
| `access.ts` | человеческие тексты ошибок входа/регистрации, `isBlocked()` | `describeAuthError`, `isBlocked` (`access.ts:52,87`) | fail-open по сети (`access.ts:82-86`) |
| `billing.ts` | типы/статика тарифов, `getMyPlan()` | `getMyPlan` (`billing.ts:127`) | молча `null` при любой ошибке — публичная страница должна жить и без RPC |
| `analytics.ts` | свои события (RPC `track_event`), first-touch атрибуция | `track`, `captureSource` (`analytics.ts:81,38`) | никогда не бросает и не блокирует |
| `errorLog.ts` | запись ошибок прода в тот же канал событий | `logError`, `installErrorLogging` (`errorLog.ts:42,73`) | дедуп по отпечатку, потолок 10/сессию |
| `feedback.ts` | отзыв пользователя через `track_event` | `sendFeedback` (`feedback.ts:32`) | ⚠️ единственное место аналитики, где ошибка НЕ глотается |
| `passwordReset.ts` | вся логика восстановления/смены пароля | `completeReset`, `changePassword` (`:167,212`) | токен проверяется при отправке формы, не при открытии страницы (см. §7) |
| `guided.ts` | ведомая сессия «Начать занятие» | `shouldAutoOpen`/`markAutoOpened` (`:119,124`) | продвижение ТОЛЬКО по нажатию, не в инициализаторе `useState` |
| `useUrlState.ts` | «адрес = где я» — состояние экрана в query-параметрах | `useUrlState`, `useUrlStates` | заход пушит историю, выход — заменяет |
| `viewTransition.ts` | обёртка над View Transitions API | `withViewTransition`, `domSettled` (`:112,75`) | `domSettled` — обязательное ожидание перерисовки (React `startTransition` иначе снимает кадр раньше) |
| `storage.ts` | безопасный localStorage (JSON/raw) | `readJson`/`writeJson`/`readRaw`/`writeRaw` | единая точка вместо разъехавшегося try/catch по 10 модулям |
| `settings.ts` | локальные настройки устройства (скорость речи, размер текста) | `getSettings`/`setSettings` | кэш в памяти + localStorage |
| `contacts.ts` | единственное место email поддержки | `supportMailto` | — |
| `account.ts` | экспорт данных + самоудаление | `collectMyData`, `deleteMyAccount` (`:13,76`) | экспорт собирается на клиенте по RLS, без новых RPC |
| `admin.ts` | обёртка над RPC `admin_*` | `findUsers`, `setPlan`, `listRecentErrors`, `listFeedback` | два места с явным приведением типа — `database.types.ts` не успевает за новыми RPC |
| `dbError.ts` | человеческий текст ошибки supabase-js | `describeDbError`, `dbError` (`:83,148`) | распознаёт свои `RECALL_*`-коды из RPC, не трогает уже человеческий русский текст из RPC |
| `useAsyncData.ts` | хук загрузки экрана, отличает «пусто» от «ошибка» | `useAsyncData` | — |
| `useScrollTop.ts` | скролл к началу при смене ВНУТРЕННЕГО состояния (не роута) | `useScrollTop` | дополняет глобальный `<ScrollToTop/>` |
| `pendingRole.ts` | метка «пришёл как преподаватель», переживающая поход в почту | `rememberPendingRole`/`hasPendingTeacherRole` | localStorage, не sessionStorage — подтверждение почты открывает страницу заново |
| `onboarding.ts` | нужен ли онбординг | `shouldOnboard` (`:34`) | вынесен из `features/onboarding` намеренно — иначе статический импорт тянул бы весь `OnboardingFlow` в главный бандл |
| `database.types.ts` (1307 строк) | сгенерированные типы Supabase | — | отстаёт от новых RPC (`admin_recent_errors`, `admin_feedback` — приведение типа в `admin.ts`) |

## 7. Инварианты каркаса и где они живут

- **`AppLink`, а не `<Link>`, для внутренних переходов.** Греет ленивый чанк
  на hover/touchstart и не запускает анимацию, если чанк не успел
  (`components/AppLink.tsx:60-63`). Экраны, идущие в обход (`<a>`/`<Link>` напрямую) —
  не встречены в моей области; `authUi.tsx` использует `AppLink` для `/terms`/`/privacy`.
- **View Transition не именует ничего внутри `<main>`.** Комментарий и правило —
  `index.css:270-281`; именуются только `.vt-topbar`/`.vt-nav` (`Layout.tsx:142,204,217` — атрибуты на `<header>`/`<nav>`), чтобы шапка/навигация не ехали вместе с контентом и не становились containing block для `fixed`.
- **Адрес = «где я».** `lib/useUrlState.ts` — заход пушит запись истории,
  возврат заменяет; применимо к 12 экранам по всему приложению (не только
  в моей области — эти 12 не пересчитывались отдельно для платформенного слоя).
- **`PROFILE_COLUMNS` и колоночные гранты.** Константа — `profile.ts:33`; любая
  новая колонка профиля требует явного `grant select`/`grant update` в
  `docs/schema.sql` (пример эволюции: `grant update (display_name, level, native_lang)` → `+goal` → `select (es_level)`/`update (es_level)` отдельными строками, `docs/schema.sql:572,1229,2989,4005-4006` — это идемпотентные переобъявления одного правила по мере роста списка колонок, не дублирующиеся мёртвые версии).
- **Токен сброса пароля проверяется при отправке формы, а не при открытии
  страницы.** `lib/passwordReset.ts:8-12` (комментарий) и реализация —
  `completeReset` (`:167-205`) не трогает токен до вызова из `ResetPasswordPage`.
- **После смены пароля — `signOut({scope:'others'})`, не `global`.**
  `passwordReset.ts:243-249` (`dropOtherSessions`), вызывается и из `completeReset`, и из `changePassword`.
- **Онбординг не гонит уже прошедших**, даже если `localStorage` потерян —
  проверка активности (`activity_log`) как второй сигнал (`lib/onboarding.ts:34-54`).
- **Ведомая сессия продвигается только по нажатию**, отметка автоперехвата
  ставится в момент навигации, а не в теле эффекта (`lib/guided.ts:108-126`,
  комментарий про StrictMode).
- **Аналитика и логирование ошибок никогда не бросают** (`analytics.ts:81-93`,
  `errorLog.ts:42-66`) — кроме `feedback.ts:32-50`, где ошибка обязана дойти до
  пользователя (комментарий `feedback.ts:13-15` объясняет разницу явно).
- **Единственный источник email поддержки** — `lib/contacts.ts:9` (`SUPPORT_EMAIL`).
- **`revoke/grant` в schema.sql** — за пределами моей прямой области (SQL), но
  затрагивает `admin.ts`/`profile.ts`: любая новая RPC требует грантов
  `authenticated` после общего `revoke` в середине файла (см. `CLAUDE.md`).

## 8. Проверки

Все проверки моей области — **вне CI** (`.github/workflows/checks.yml` гоняет
только `npm run build`, `check-api-vercel.mjs`, список чистых `test-*.mjs` (в
котором НЕТ ни одного теста из платформенного слоя) и `validate-exercises.mjs`/`check-schema.mjs`).
Браузерные смоуки моей области требуют dev-сервера, `SUPABASE_SERVICE_KEY` и
запускаются вручную:

- `scripts/smoke-navigation.mjs` — «назад»/F5 на внутренних экранах (правило `useUrlState`).
- `scripts/smoke-motion.mjs` — переходы, вкладки, `Thinking`/`answer-pop` как класс мест, keyframes живы в собранном CSS.
- `scripts/smoke-password-reset.mjs` (+ прод-прогон с `AUDIT_BASE_URL`) и `scripts/check-auth-setup.mjs` — путь восстановления пароля целиком, без единого письма.
- `scripts/smoke-account.mjs` — `es_level` переживает сохранение, `delete_my_account` стирает аккаунт.
- `scripts/smoke-feedback.mjs` — путь отзыва целиком (кнопка → шторка → запись → `admin_feedback`).
- `scripts/smoke-onboarding-placement.mjs` — стык онбординг → тест уровня (регрессия конкретного бага, была недостижима).
- `scripts/ux-audit.mjs` — контраст и тач-цели на 15 экранах (частично моя область: настройки, тарифы, вход).
- `scripts/check-anon-access.mjs` — покрывает и `admin.ts`/`account.ts` RPC косвенно (проверка на живой базе, не в этой описи детально, см. `CLAUDE.md`).

Нет отдельного смоука на: меню профиля (`AvatarMenu`), `ErrorBoundary`
(chunk-reload сценарий), `EnergyBar` (энергия проверяется, видимо, через
смоуки других разделов, которые тратят энергию).

## 9. Как резать при переезде

**Фундамент — без него НИ ОДИН раздел не переедет:**
1. Токены `index.css:19-53` + недостающие danger/warning/success — переезжают ПЕРВЫМИ, до правки любого общего компонента, иначе `Button`/`Sheet`/`LoadError` унесут хардкод дальше.
2. `Button`, `Card`, `RowCard`, `Sheet`, `Picker`, `TabPicker`, `AppLink`, `Loading`/`RowsSkeleton`, `Reveal`, `Thinking` — самые импортируемые общие компоненты (48/40/…); их контракт (пропсы) трогать с оглядкой на все точки использования, а не переписывать «заодно».
3. `lib/routeChunks.ts` + `App.tsx` — карта роутов; при переезде раздела меняется ОДНА строка (путь к новому файлу компонента), сам `App.tsx` — нет.
4. `ProtectedRoute.tsx` — весь гейт входа/блокировки/онбординга; трогать отдельно от переезда конкретной фичи, это общий слой.
5. `lib/useUrlState.ts` + `lib/viewTransition.ts` — если новый раздел не следует «адрес = где я», он выпадает из PWA-навигации (нет свайпа назад).
6. `lib/profile.ts` (`PROFILE_COLUMNS`), `lib/dbError.ts`, `lib/storage.ts` — инфраструктурные, используются почти всеми lib-модулями фич, не только каркасом.

**Что можно резать независимо (по разделу за раз), без риска зацепить остальное:**
- `auth/*` — самодостаточен (свой `authUi.tsx`), НЕ использует общий `Button`/`Card`. Перевод на общие компоненты — отдельная, изолированная задача (заодно устранит дублирование `PrimaryButton` ≈ `Button`).
- `onboarding/*` — тоже самодостаточен по стилю (весь инлайн-Tailwind), логика (`lib/guided`, `lib/onboarding`, `lib/teacher.joinTeacher`) уже вынесена.
- `settings/*` — три файла, зависимости названы (`lib/account`, `lib/passwordReset`, `lib/settings`, `lib/esLevel`); сегмент-переключатели — сознательно не `TabPicker`, при переезде можно решить свести или оставить as-is.
- `billing/`, `admin/`, `landing/`, `legal/` — по одному файлу, зависимости узкие, наименьший риск.
- `dashboard/`, `progress/` — крупнее, но уже следуют общим компонентам (`RowCard`, `Button`, `EnergyBar`, `HowItWorks`) — редизайн токенов их почти не тронет, тронет в основном hex/inline-style в двух местах (`DashboardPage.tsx:437`).

**Порядок, который снижает риск:** токены → общие компоненты (Button/Card/RowCard/Sheet и семья) → auth (самый изолированный, но с наибольшим числом хардкода) → onboarding → settings → dashboard/progress → billing/admin/landing/legal (низкий риск, можно в любой момент).

## 10. Сквозные наблюдения

1. **Общие компоненты сами обходят токены.** `Button.tsx:20` (danger — raw red/white), `Sheet.tsx:116` (ручка — `bg-slate-600`) — до правки токенов эти два места нужно чинить в первую очередь, иначе они «протекут» в любой мигрировавший раздел.
2. **Экраны входа/онбординга живут в параллельной дизайн-системе.** `authUi.tsx` и весь `OnboardingFlow.tsx` не используют `Button`/`Card` — не потому что забыли, а потому что писались раньше введения общих компонентов и не были обратно засинхронизированы.
3. **Danger/warning/success токенов нет вообще** — 105+21+30 = 156+ мест с сырыми `red-/amber-/green-/emerald-` классами по всему `src`. Это самая большая единичная категория «долга токенов».
4. **Три реализации «кнопки назад»** (`BackButton`, `SmartBack`, инлайн в `SettingsPage`) решают близкие, но не идентичные задачи (внутри/вне Layout) — не обязательно баг, но кандидат на явное разграничение в редизайне.
5. **57 иконок, 4 не используются нигде** (`IconStudents`, `IconSpeechFill`, `IconSpeech`, `IconMicFill`) — кандидаты на удаление при следующей перегенерации набора.
6. **CI не покрывает каркас вообще.** Все проверки навигации, переходов, восстановления пароля, отзыва, аккаунта — ручные локальные смоуки с dev-сервером; при переезде разделов регрессию поймает только тот, кто вручную прогонит скрипт.
7. **`database.types.ts` отстаёт от новых RPC** (`admin_recent_errors`, `admin_feedback`) — два места явного приведения типа в `lib/admin.ts`, которые исчезнут сами при перегенерации типов после заливки схемы (см. `ARCHITECTURE.md`, не проверялось в этой описи).
8. **Комментарий про «нет скользящего индикатора» в `CLAUDE.md` не совпадает с кодом.** `BottomNav.tsx` сейчас рисует скользящую подложку (`:89-97`). Стоит либо обновить преамбулу `CLAUDE.md`, либо (если это другой механизм, о котором шла речь) — уточнить у владельца.
9. **`PlacementTest.tsx` — единственный экран онбординга, идущий в базу мимо `lib/`** (пишет `profiles` напрямую) — при переезде раздела стоит решить, заводить ли для этого отдельную функцию в `lib/onboarding.ts` или `lib/placement.ts`.
10. **Toков «состояние» в каркасе мало и они простые**: `AuthContext` (сессия), `LanguageContext` (EN/ES в localStorage), `sessionStorage` (guided-сессия, recovery-токен), `localStorage` (онбординг-флаг, pending-role, кэш уровня, настройки устройства) — нет ни одного глобального стора состояния (Redux/Zustand и т.п.), что соответствует «зависимостей UI — ноль» из `CLAUDE.md`.

## 11. Вопросы, которые не удалось прояснить

- Скользящая подложка `BottomNav` (§2, наблюдение 8) — противоречит преамбуле `CLAUDE.md`. Не выяснено, был ли это возврат функциональности, ошибка документа, или комментарий имел в виду другой (более ранний) индикатор.
- Точные счётчики использования иконок и общих компонентов — грубые оценки через `grep` (подстрочные совпадения типа `IconHome`/`IconHomeFill`, импорт через компонент-обёртку типа `Sheet`→`Picker`→фича). Для точных чисел нужен AST-анализ (возможно, стоит расширить `scripts/arch-map.mjs`).
- Не проверялось, какие из 621 «сырых tailwind-цветов» дублируют существующий токен один-в-один (кандидаты на автозамену) против тех, что реально новые оттенки (кандидаты на новый токен) — это отдельная задача перед самим редизайном.
- Не выяснялось, почему `admin.ts` и `database.types.ts` разошлись именно по двум RPC (`admin_recent_errors`, `admin_feedback`) — возможно, это признак того, что типы вообще давно не перегенерировались; не проверялась дата последней генерации.
