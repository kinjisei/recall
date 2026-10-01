# Архив — устаревшие документы

> Здесь ничего не правится и ничего не планируется. Единственный план —
> `docs/PLAN.md`; правила кода — `CLAUDE.md` в корне и в папках модулей.
> Документы лежат здесь, чтобы старые ссылки (комментарии в применённых
> миграциях, коммиты, журнал) можно было открыть.

## Что здесь и куда ушло живое

| Файл | Что это было | Живое теперь |
|---|---|---|
| `ARCHITECTURE.md` | контракты, модель данных, роуты (с июля) | инварианты базы, сверенные со схемой — `supabase/CLAUDE.md`; сигнатуры — сам код и блоки generated; осознанные остатки — корневой `CLAUDE.md` и `PLAN.md` Ф2.15 |
| `app-map.md` | карта продукта и пробелы (22.08) | карта — корневой `CLAUDE.md`; пробелы — `PLAN.md` Ф2.15 |
| `work-plan.md` | план заходов и роадмап блоков (до 23.08) | открытое — `PLAN.md` Ф2.15; «годового тарифа нет» — `src/features/billing/CLAUDE.md` |
| `findings.md` | журнал находок аудитов (июль–август) | открытое — `PLAN.md` Ф2.15 |
| `repair-plan.md` | план ремонта после пяти ревью (07.08) | открытое — `PLAN.md` Ф2.15 (А1, В13) |
| `plan-2026-07-features.md`, `roadmap-2026-07-grilling.md` | заходы фич июля и решения к ним | открытое — `PLAN.md` Ф2.15 (В4) |
| `mkt/19-fix-plan.md`, `mkt/21-open-issues.md` | реестр недочётов и сверка открытого (август) | открытое — `PLAN.md` Ф2.15 |
| `schema-2026-09-27.sql` | схема одним файлом до миграций | `supabase/migrations/` |

Сверка «что из этого ещё открыто» сделана 01.10.2026 (Ф1.7) по коду, плану и
журналу решений: закрытое в коде и отменённое решениями в план не попало.

## Старый корневой `CLAUDE.md` → куда переехало

До 01.10.2026 корневой `CLAUDE.md` (1022 строки) держал механики всех
разделов и читался целиком в каждой сессии. Его текст — в истории git
(`git show <коммит до Ф1.7>:CLAUDE.md`). Механики разъехались по описаниям
модулей — каждая ровно в одно:

| Раздел старого `CLAUDE.md` | Где теперь |
|---|---|
| Что это, язык общения, стек, источники правды, карта продукта | корневой `CLAUDE.md`; состав контента — `src/data/CLAUDE.md`; «dev = те же обработчики», ключи без `VITE_` — `api/CLAUDE.md` |
| Структура кода | корневой `CLAUDE.md` «Слои и папки»; модули — `src/lib/CLAUDE.md`, `src/components/CLAUDE.md`, `api/CLAUDE.md` |
| Энергия ⚡, тарифы | `src/features/billing/CLAUDE.md` |
| Безопасность — три правила | корневой `CLAUDE.md`; права на функции, два пояса, `check-anon-access` — `supabase/CLAUDE.md` |
| Слова ученика — одно место | `src/features/teacher/CLAUDE.md` |
| Пак — одна тема | `src/features/flashcards/CLAUDE.md`; «файлы словаря не трогаем» — `src/data/CLAUDE.md` |
| Домашка на неделю — один объект | `src/features/homework/CLAUDE.md`; карточка ученика и `?sec=` — `src/features/teacher/CLAUDE.md` |
| Список учеников: кому нужно внимание | `src/features/teacher/CLAUDE.md` |
| Домашка у ученика | `src/features/homework/CLAUDE.md`; «проговорить вслух» — `src/features/pronunciation/CLAUDE.md`; время от сервера в смоуках — `scripts/CLAUDE.md` |
| Подбор домашки | `src/features/homework/CLAUDE.md`; `plural` — `src/shared/CLAUDE.md` |
| Самокоррекция, обратная связь | `src/components/CLAUDE.md` |
| Фокусная правка письма | `src/features/writing/CLAUDE.md`; `innerText` в смоуках — `scripts/CLAUDE.md` |
| Задания собираются под ученика | `src/features/teacher/CLAUDE.md` |
| AI: клиент шлёт задачу; у запроса есть срок | `api/CLAUDE.md` |
| AI: журнал вызовов и лимиты | `src/domains/ai/CLAUDE.md`; «модели выключают без нашего ведома» — `api/CLAUDE.md` |
| Ведомая сессия «Начать занятие» | `src/features/dashboard/CLAUDE.md` |
| Навигация: адрес = «где я» | `src/shared/CLAUDE.md` |
| Дизайн — Nocturne, движение | `src/shared/ui/CLAUDE.md`; переход ждёт перерисовки — `src/shared/CLAUDE.md`; `AppLink`, `.vt-*`, `view-transition-name` — `src/app/CLAUDE.md`; Главная одним кадром — `src/features/dashboard/CLAUDE.md` |
| Пароль: восстановление и смена | `src/features/auth/CLAUDE.md` |
| Уведомления | `src/domains/notifications/CLAUDE.md` |
| Как запустить и проверять | корневой `CLAUDE.md` (главные команды); остальные — «Как проверить» модулей |
| Сторожа | корневой `CLAUDE.md` (коротко), `scripts/checks/README.md`; `npm run build` ≠ Vercel — `api/CLAUDE.md` |
| Скрипты и тестовая база, браузер в смоуках | `scripts/CLAUDE.md` |
| Правила работы | корневой `CLAUDE.md`; миграции не правятся, порядок выкатки, слепок каталога — `supabase/CLAUDE.md` |
| Уроки | корневой `CLAUDE.md`; iOS и новая версия PWA — `src/app/CLAUDE.md` |
| Что ждёт владельца | `docs/PLAN.md` «Дела владельца»; пароль базы прода и бэкап — `supabase/CLAUDE.md` |

Не перенесено намеренно — устарело или было неверно: счёт проверок
(«29/29», «16/16»; разошёлся сам с собой), «12 экранов в адресе», «Thinking —
6 мест», «стартовый бандл 338 КБ» (с Ф1.4 — 96 КБ gzip), «`/conversation` —
режим «Письмо»» (письмо давно в `/writing`), «`homeworkRows` в
`lib/homework.ts`» (он в `lib/homeworkView.ts`), проверка пароля на проде без
`--prod`, сделанные дела владельца (миграции 0002–0003, открытая регистрация).
