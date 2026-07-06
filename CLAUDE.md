# Recall — контекст проекта для Claude

> Этот файл читается автоматически при старте сессии Claude Code в этой папке.
> Он даёт полный контекст, чтобы продолжить работу без потери нити.

## Что это
**Recall** — PWA для изучения **двух языков: английского и испанского**
(переключатель EN/ES в шапке; язык хранится в localStorage `recall.lang`).
- Пользователь (владелец): англ. был B2, сейчас ~B1, цель — восстановить; испанский — с нуля.
- Его девушка: англ. C1, цель — не терять навык.
- Будущее (Фаза 4): режим «Преподаватель» — девушка учит своих учениц через приложение.
- Условие: всё на **бесплатных** тарифах.

2026-07-07: в Recall влит контент Flutter-приложения `d:\projects\spanish`
(паки слов A1/A2 по темам, 40 текстов, 25 диалогов, 105 фраз для произношения —
JSON в `src/data/spanish/`). Flutter-код не переносился, приложение spanish
осталось нетронутым. Не перенесено (кандидаты на потом): грамматика,
спряжения глаголов, тренажёр окончаний, placement-тест, большой CSV на 2637 слов.

## Язык общения
Отвечай пользователю **по-русски**. Он новичок в программировании, готов
копипастить и следовать пошаговым инструкциям. Claude работает напрямую в его
VS Code (есть доступ к файлам и терминалу) — поэтому фичи собираются прямо в
проекте и тут же тестируются, а не отдаются «воркерам» вручную.

## Стек
- Frontend: **Vite + React 19 + TypeScript + Tailwind v4** (`@tailwindcss/vite`), PWA (`vite-plugin-pwa`)
- Бэкенд/данные/вход: **Supabase** (Postgres + Auth + RLS). URL: `https://qyvkyyjqqqirmdliddsn.supabase.co`
- AI: **Gemini Flash** (free tier) через **Vercel serverless** `/api/gemini` (ключ прячется на сервере)
- Озвучка/распознавание: **Web Speech API** (браузер, бесплатно; en-US и es-ES)
- Словарь EN: **Free Dictionary API** (`dictionaryapi.dev`, без ключа)
- Словарь ES: локальные паки слов → fallback на Gemini (`lib/spanishDict.ts`)
- Интервальное повторение: **ts-fsrs** (алгоритм FSRS)
- Хостинг: **Vercel**

## Источники правды
- Архитектура и контракты: `docs/ARCHITECTURE.md` (названия папок, типы, схема БД, сигнатуры — не отклоняться)
- Схема базы: `docs/schema.sql` (уже выполнена в Supabase)

## Структура
```
src/
  lib/        supabase.ts, cards.ts (addCard, getDefaultDeck(lang), addCardsBulk),
              fsrs.ts (getDueCards(limit, lang)), dictionary.ts (EN),
              spanishDict.ts (ES: паки → Gemini), speech.ts (en-US/es-ES),
              gemini.ts (клиент /api/gemini), activity.ts (стрик)
  types/      index.ts — все общие типы (+ AppLang, Spanish*)
  context/    AuthContext.tsx, LanguageContext.tsx (EN/ES)
  data/       spanish/ — контент из приложения spanish (JSON + index.ts)
  components/ Button, Card, Layout (шапка с EN/ES), BottomNav, ProtectedRoute
  features/   dashboard, flashcards (+PacksSheet — паки исп. слов),
              reader (+SpanishReader — исп. тексты и диалоги), pronunciation,
              conversation (внутри — режимы Чат и Письмо, промпты EN/ES)
api/          gemini.ts (Vercel serverless), _core.ts (общий вызов Gemini)
vercel.json   SPA-rewrite для деплоя (не перекрывает /api/*)
```
Локальный dev-эндпоинт /api/gemini живёт в vite.config.ts (Vercel CLI не нужен);
ключ — строка `GEMINI_API_KEY=...` в `.env.local` (БЕЗ префикса VITE_).
Нижняя навигация: Главная / Колода / Ввод / Речь / Диалог.

## Как запустить
```
npm install      # если нужно
npm run dev      # http://localhost:5173
npm run build    # проверка типов (tsc -b) + сборка
```
В `.env.local` уже прописаны `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.

## Статус (на момент переноса проекта в D:\projects\recall-app)
Готово и протестировано:
- ✅ Фаза 0 (аккаунты, Node), Фаза 1 (Фундамент: вход, навигация, Supabase, типы)
- ✅ Фича 1 «Колода» — FSRS-повторение + ручное добавление слов (`features/flashcards`, `lib/fsrs.ts`)
- ✅ Фича 2 «Ввод» — чтение текстов, тап по слову → словарь → в колоду (`features/reader`, `lib/dictionary.ts`, `sampleTexts.ts`)
- ✅ Фича 3 «Речь» — шэдоуинг: озвучка + распознавание + оценка в % (`features/pronunciation`, `lib/speech.ts`). Только Chrome/Edge, нужен микрофон.

Собрано, ждёт ручного теста пользователя (2026-07-02):
- 🔶 **Фича 4 «AI»** — Gemini-прокси + чат и проверка письма во вкладке «Диалог». Живой вызов Gemini через dev-эндпоинт проверен (ответ с исправлением ошибки пришёл).
- 🔶 **Фаза 3, ядро** — `lib/activity.ts` (стрик, «сделано сегодня», день в местном времени), запись активности из всех 4 фич, живой дашборд (стрик, счётчик карточек к повторению, бейджи «✓ сделано»).
- 🔶 **Иконки PWA** — сгенерированы в `public/` (192/512/maskable + favicon.svg + apple-touch-icon), прописаны в манифесте; установка приложения теперь возможна.

Собрано, ждёт ручного теста пользователя (2026-07-07):
- 🔶 **Мультиязычность EN/ES** — объединение с приложением spanish. Переключатель
  в шапке; у колод появился `lang`; все 4 фичи работают на обоих языках; паки
  испанских слов A1/A2 («📦 Паки» в Колоде), исп. тексты и диалоги в «Вводе»,
  исп. фразы в «Речи», исп. промпты в «Диалоге».
  ⚠️ **Перед тестом обязательно повторно выполнить `docs/schema.sql` в Supabase**
  (SQL Editor → вставить весь файл → Run): добавляет `decks.lang` и испанскую
  колоду каждому пользователю. Без этого сломается и английский режим.

- ✅ **Деплой на Vercel (2026-07-07)** — https://recall-pgkz.vercel.app, репозиторий
  https://github.com/kinjisei/recall (private). Автодеплой: пуш в `main` → Vercel сам
  пересобирает. Env в Vercel: GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
  В ESM-импортах внутри `api/` обязательно расширение `.js` (иначе
  FUNCTION_INVOCATION_FAILED). Прод проверен E2E-прогоном (EN и ES сценарии).

Дальше (позже):
- Фаза 4 — режим «Преподаватель» (роли, назначение колод, прогресс учениц).
- Перенос остального из spanish: грамматика, спряжения, тренажёр окончаний, placement-тест.
- Полировка: код-сплиттинг бандла (769 КБ из-за испанских JSON), усилить ✏️-исправления
  в испанском промпте (иногда пропускает ошибки).

## Правила
- Не ломать контракты из `docs/ARCHITECTURE.md`. Импортировать типы из `src/types`.
- Каждая фича — в своей папке `features/*` + свой файл `lib/*`. Общие файлы менять аккуратно.
- После изменений проверять `npm run build`.
