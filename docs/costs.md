# Расходы на инфраструктуру Recall — что бесплатно, что платно, когда упрёмся в лимиты

> Собрано: 2026-07-24. Цены, лимиты и правила у Vercel/Supabase/Google/Groq
> **меняются без предупреждения** — перед важным решением (особенно про
> Gemini billing) открой ссылки из этого файла глазами и проверь, что цифры
> не изменились. Всё, что помечено «(требует проверки)», — это вывод низкой
> уверенности, а не подтверждённый факт.

---

## 1. Ответ на главный вопрос: что будет с Gemini, если подключить billing

**Коротко:** free tier Gemini API — это не свойство твоего Google-аккаунта, а
свойство конкретного **проекта** в Google Cloud. Пока к проекту не привязан
активный billing-аккаунт — проект живёт на Free Tier (лимиты RPD как сейчас,
`gemini-2.5-flash`/`flash-lite`/`gemma` бесплатны). Как только к проекту
привязывают billing (карту) — проект **мгновенно** переключается на платный
тир (Tier 1), и с этого момента **каждый** запрос к платным моделям
(`gemini-2.5-flash` и т.п.) тарифицируется по цене за токены — бесплатной
дневной квоты для них больше нет. Это подтверждено официальной документацией
двумя независимыми страницами ([rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits),
[billing](https://ai.google.dev/gemini-api/docs/billing)):

> «Rate limits are tied to the project's usage tier... Free: Active project or
> free trial | Tier 1: Set up and link an active billing account»
> — [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)

> «Tier upgrades from the Free to Tier 1 will typically take effect instantly»
> — [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)

**Важное исключение — модели Gemma.** В таблице цен у Gemma (`gemma-3`,
`gemma-4-31b` и т.д.) колонка «Paid Tier» стоит как **«Not available»** —
то есть у Gemma платного тарифа физически нет, она остаётся бесплатной
(RPD ~14 400) даже на проекте с привязанной картой:

> «Paid Tier Input: "Not available"; Paid Tier Output: "Not available"»
> (строка Gemma) — [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Схема «два проекта» (один free, один платный) — технически работает.**
Тир привязан к паре «проект ↔ billing-аккаунт», а не к пользователю Google
целиком:

> «Tiers, rate limits, and billing account caps are all determined at the
> billing account level. All projects linked to a Cloud Billing account
> inherit the billing account's usage tier»
> — [ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing)

> «To downgrade to the Free Tier, you can disable billing on each of your
> projects that you want to downgrade»
> — [ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing)

Из этих двух цитат логически следует: если у Recall будет **Проект A без
привязанного billing** (остаётся Free) и отдельный **Проект B с billing**
(Paid), у каждого будет свой ключ и свой тир. Подвох один — если по ошибке
привязать **тот же самый** billing-аккаунт к обоим проектам, оба станут
платными разом (правило наследования тира выше). Так что для этой схемы
billing-аккаунт должен быть подключён только к проекту B, а у проекта A
billing вообще не создаваться.

**Юридическая серая зона (честно, не нашлось прямого ответа):** дословного
запрета в Terms of Service или Prohibited Use Policy на «завести два проекта
ради двух бесплатных квот» не нашлось — ни разрешения, ни запрета
первоисточник не формулирует явно. Сторонний агрегатор утверждает, что запрет
есть, но без цитаты из документа Google — доверия низкое, не подтверждено
**(требует проверки)**:
[apiyi.com, неофициальный источник](https://help.apiyi.com/en/gemini-3-1-pro-429-rate-limit-quota-exceeded-fix-guide-en.html).
Практический вывод для Recall: схема «два проекта» — это не про обход
единого лимита одного и того же аккаунта (тир честно привязан к
проект+billing), а скорее нормальная архитектура «дев-ключ / прод-ключ» —
рискованной она была бы, если тем же трюком пытаться разово удвоить квоту
одного и того же продакшена под одной и той же нагрузкой.

**С апреля 2026 — новый нюанс.** Google документирует обязательные
(неотключаемые) капы месячных трат на уровне billing-аккаунта для каждого
платного тира:

> «Starting April 1, 2026, Google enforces maximum monthly spend limits at
> the billing account level for every usage tier as mandatory caps that
> cannot be disabled»
> — [ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing)

Это значит: даже подключив карту, ты физически не можешь случайно потратить
больше капа своего тира за месяц — при достижении лимита запросы просто
остановятся до следующего периода, а не «улетят в космос» по счёту.

### Практический вывод для Recall
- Сейчас (без billing) — Free Tier для `gemini-2.5-flash`/`flash-lite` и
  бесплатная Gemma остаются как есть.
- Если возникнет нужда в более высоких RPD для тяжёлых моделей — можно
  завести **отдельный второй Google Cloud проект**, привязать к нему billing
  и брать оттуда отдельный ключ, не трогая billing первого (free) проекта.
  Это не «взлом», а штатная механика тиров — но юридически не 100%
  прозрачно задокументировано именно для сценария «две бесплатные квоты
  вместо одной», так что закладывай это как риск, а не гарантию.
- После подключения billing к проекту — Gemini для этого проекта перестаёт
  быть бесплатным ПОЛНОСТЬЮ, кроме Gemma.

---

## 2. Траты при 0 / 50 / 200 / 1000 активных пользователей в месяц

**Явные допущения (грубая прикидка, не измерено в проде):**
- «Активный пользователь» = ученица/ученик, кто реально занимается почти
  каждый день.
- ~10 heavy AI-запросов в день на активного пользователя (Диалог, письмо,
  квесты — самое частое; по CLAUDE.md лимит free-плана — 5/день, триала —
  12/день, платного — 200/день, то есть 10/день — реалистичная средняя
  нагрузка вовлечённой ученицы).
- ~15 light-запросов/день (переводы слов по тапу, определения) и
  ~2 speech-запроса/день (Groq Whisper, «Речь») на активного пользователя.
- След в БД на пользователя (профиль, колоды, карточки, review_states,
  activity_log, диалоги/квесты в jsonb) — грубо 0.5–2 МБ за несколько
  месяцев (оценка низкой уверенности, см. раздел Supabase).
- Google Play $25 и домен — разовые/годовые траты, не зависят от числа
  пользователей — вынесены отдельными строками.

| Сервис | 0 польз. | 50 польз. | 200 польз. | 1000 польз. |
|---|---|---|---|---|
| **Vercel** (Hobby, до коммерции) | 0 ₸ | 0 ₸, вписывается в 100 GB/мес и 1M вызовов | 0 ₸, но близко к границе (см. §3) — трафик и число функций растут | **Обязателен Pro** ($20/мес + usage) — и по лимитам, и по правилам (приём оплаты от пользователей = коммерческое использование, Hobby запрещён ToS) |
| **Supabase** (Free: 500 MB БД, 50k MAU, 5 GB egress) | 0 ₸ | 0 ₸, укладывается с запасом | 0 ₸, но БД может приблизиться к 500 MB при активном использовании (диагностика/квесты копят jsonb) | Вероятно **нужен Pro** ($25/мес) — 1000 активных пользователей за несколько месяцев легко перерастут 500 MB и точно потребуют надёжности (бэкапы, отсутствие авто-паузы недоступно на Free) |
| **Gemini API** (Free Tier, без billing) | 0 ₸ | 0 ₸ при текущем порядке моделей (gemma/flash-lite первыми, см. CLAUDE.md) — но реальный запас зависит от RPD конкретных моделей в цепочке | Вероятно упрёмся в RPD 3.5/3.6-flash первыми — тогда фолбэк на gemma (бесплатно, но качество проще) или **придётся подключать billing** = платный тир (Gemma останется бесплатной, остальное — по цене токенов, напр. Flash: $0.30 вход / $2.50 выход за 1M) | Почти наверняка **придётся включать billing** на часть моделей — 1000×10 heavy-запросов/день это 10 000 запросов/день, что кратно выше freе RPD большинства платных Gemini-моделей |
| **Groq API** (Free tier) | 0 ₸ | 0 ₸, `llama-3.1-8b-instant` — 14 400 RPD с запасом | 200×2 speech-запроса/день = 400/день — всё ещё ниже 2 000 RPD у Whisper, но близко, если добавить пики | Вероятно упрёмся в RPD Whisper (2 000/день) на функции «Речь» — либо переход на **Developer-план** Groq (нужна карта, лимиты выше, но точные цифры не опубликованы — (требует проверки)), либо платный fallback |
| **Домен (.kz или .com)** | ~9 580 ₸/год (разово в год, не зависит от пользователей) | то же | то же | то же |
| **Google Play Console** | $25 (разово, один раз навсегда) | — | — | — |
| **Налоги** (самозанятость с 2026) | 0 ₸, пока нет дохода | 0%, ИПН 0% + 4% соцплатежи с ЛЮБОГО дохода от тарифов, если открыт как самозанятый | то же, 4% с оборота, пока доход < ~1 297 500 ₸/мес (300 МРП, порог самозанятости) (требует проверки — цифра из вторичного источника) | При обороте выше порога самозанятости — переход на другой режим (розничный налог 4-8% или общий); порог перехода не найден в первоисточнике |

---

## 3. Когда что придётся оплатить первым (по порядку срабатывания)

Упорядочено от «сработает раньше всех» к «сработает позже всех», при
допущениях из раздела 2:

1. **Vercel Hobby → Pro из-за правил ToS, а не из-за трафика.** Как только
   Recall начинает реально принимать оплату от пользователей (Kaspi-переводы
   за тарифы уже есть по CLAUDE.md) — это подпадает под официальное
   определение коммерческого использования («любой способ запроса/обработки
   оплаты от посетителей сайта»), и Hobby формально запрещён это делать
   независимо от объёма трафика:
   > «Any method of requesting or processing payment from visitors of the
   > site» — [vercel.com/docs/limits/fair-use-guidelines](https://vercel.com/docs/limits/fair-use-guidelines)

   Это **самый ранний триггер** — он срабатывает не по числу пользователей,
   а по факту монетизации, то есть уже сейчас, если Recall уже принимает
   оплату.

2. **Gemini free RPD у самых востребованных моделей** (`gemini-2.5-flash` и
   похожие) — упрётся при относительно небольшом числе активных
   пользователей, если много heavy-запросов идёт именно в эти модели.
   Смягчается текущим порядком фолбэков (gemma первой в standard — RPD
   ~14 400, тезис из CLAUDE.md), но при росте пользователей до нескольких
   сотен активных гарантированно понадобится либо больше free-моделей в
   цепочке, либо billing на часть трафика.

3. **Groq Whisper RPD (2 000/день)** — заметно упрётся на функции «Речь»
   при набирании базы активных пользователей (полные Whisper-лимиты меньше,
   чем у llama-моделей).

4. **Supabase 500 MB БД** — самый «долгий» лимит: по грубой оценке
   0.5–2 МБ на пользователя, 500 MB хватает примерно на 250–1000 активных
   пользователей **(требует проверки — оценка низкой уверенности, нужен
   реальный замер объёма БД в Dashboard)**. Скорее всего, сработает позже
   всех остальных лимитов.

5. **Vercel bandwidth/CPU-лимиты Hobby** — по факту, скорее всего, наступят
   позже пункта 1 (правило ToS про коммерцию срабатывает раньше, чем
   реальные лимиты трафика/CPU для приложения такого размера).

---

## 4. Рекомендация

1. **Прямо сейчас проверить статус Vercel-плана.** Если Recall уже принимает
   оплату через Kaspi (а по CLAUDE.md — принимает), формально это уже
   коммерческое использование и Hobby-план нарушает Terms of Service
   независимо от объёма трафика — стоит либо перейти на Pro ($20/мес),
   либо явно оценить риск «Vercel может отключить проект без предупреждения»
   (это прописанное право Vercel — не гипотетика).
2. **Не подключать billing к текущему (единственному) Google Cloud проекту
   с Gemini-ключом**, пока не появится реальная нужда — это необратимо
   переключает Flash-модели этого проекта на платный счёт. Если нужен запас
   прочности — заводить **отдельный** проект с billing, не трогая
   существующий free-проект.
3. **Мониторить вручную, без автоматики:**
   - Supabase Dashboard → Database → Database size (раз в месяц-два, чтобы
     не гадать про 500 MB);
   - Vercel Dashboard → Usage (bandwidth, function invocations, active CPU);
   - Частоту 429-ошибок от Gemini/Groq в логах — если конкретная модель в
     цепочке фолбэков стала упираться в RPD регулярно, это сигнал заранее,
     до реального отказа пользователю.
4. **Когда включать платное — по порогам:**
   - Vercel Pro — как только официально не готов рисковать отключением
     проекта Vercel'ом (см. пункт 1), либо когда трафик реально приблизится
     к 100 GB/мес;
   - Supabase Pro — когда Database size перевалит ~350–400 MB (запас перед
     жёстким лимитом 500 MB) или когда критична надёжность (бэкапы — на
     Free их просто нет);
   - Gemini billing (на отдельном проекте) — когда фолбэк-цепочка
     регулярно проседает до самых слабых моделей из-за исчерпания RPD у
     сильных;
   - Groq Developer-план — если функция «Речь» начнёт систематически
     получать 429 от Whisper.
5. **Налоги — решить до первого реального перевода от пользователя (не
   тестового):** зарегистрироваться самозанятым (0% ИПН + 4% соцплатежи с
   2026 года) до того, как оборот станет заметным — но сначала стоит
   отдельно проверить, входит ли деятельность «разработка/продажа доступа
   к приложению» в официальный перечень видов деятельности, разрешённых
   для этого режима **(не проверено в первоисточнике)**.

---

## Источники (все ссылки из ресёрча)

**Vercel:**
[Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) ·
[Hobby plan](https://vercel.com/docs/plans/hobby) ·
[Limits](https://vercel.com/docs/limits) ·
[Terms of Service](https://vercel.com/legal/terms) ·
[Pricing](https://vercel.com/pricing)

**Supabase:**
[Pricing](https://supabase.com/pricing) ·
[Billing on Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase) ·
[Monthly Active Users](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) ·
[Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)

**Gemini API:**
[Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) ·
[Pricing](https://ai.google.dev/gemini-api/docs/pricing) ·
[Billing](https://ai.google.dev/gemini-api/docs/billing) ·
[Usage policies](https://ai.google.dev/gemini-api/docs/usage-policies) ·
[apiyi.com — неофициальный агрегатор (требует проверки)](https://help.apiyi.com/en/gemini-3-1-pro-429-rate-limit-quota-exceeded-fix-guide-en.html) ·
[Форум Google AI Developers — задержка апгрейда тира (требует проверки)](https://discuss.ai.google.dev/t/billing-setup-complete-but-quota-tier-stuck-on-free-tier-multiple-projects-multiple-keys/130113)

**Groq API:**
[Rate limits](https://console.groq.com/docs/rate-limits) ·
[Pricing](https://groq.com/pricing) ·
[tokenmix.ai — неофициальный агрегатор (требует проверки)](https://tokenmix.ai/blog/groq-free-tier-limits-2026)

**Разовые/налоговые траты:**
[Google Play — регистрация разработчика ($25)](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en) ·
[onehost.kz — цены доменов .kz с 2026 (требует проверки)](https://onehost.kz/news/s-1-yanvarya-2026-goda-izmenitsya-stoimost-domenov-v-zonakh-kz-i-kaz/) ·
[hoster.kz — живые цены доменов](https://hoster.kz/domains/register/) ·
[kgd.gov.kz — спецрежим для самозанятых с 2026](https://vko.kgd.gov.kz/ru/news/specialnyy-nalogovyy-rezhim-dlya-samozanyatyh-8-160716) ·
[alataucitybank.kz — расчёт порога 300 МРП (требует проверки)](https://alataucitybank.kz/business/osim/articles/kakie-nalogi-platit-samozanyatyy) ·
[mybuh.kz — E-Salyq Business для самозанятых (требует проверки)](https://mybuh.kz/useful/snr-s-ispolzovaniem-spetsialnogo-mobilnogo-prilozheniya.html) ·
[kgd.gov.kz — розничный налог](https://kgd.gov.kz/ru/news/specialnyy-nalogovyy-rezhim-roznichnogo-naloga-kakie-lgoty-predusmotreny-1-143768)
