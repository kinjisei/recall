# Gap-отчёт: английская грамматика Recall

**Дата:** 2026-07-22 · **OCR-сверка сканов:** 2026-07-23
**Наша программа:** 60 уроков A1–C1 (`src/data/english/grammar/`).

## Источники сравнения

- **New Headway** Beginner–Advanced — через тематический атлас NotebookLM (оглавления всех уровней).
- **New Headway Elementary** и **Pre-Intermediate** — Student's Book + Workbook, разбор напрямую по оглавлениям.
- **New Headway Intermediate, Upper-Intermediate, Advanced (SB+WB)** — прочитаны напрямую по **OCR-оглавлениям** (2026-07-23). Раньше учитывались только косвенно через атлас.
- **English for Everyone (EFE)** — Grammar Guide + Level 2 Beginner, напрямую по оглавлениям.
- **4000 Essential English Words 1–6**, Second Edition (Paul Nation) — это **лексические/чтение-курсы**, не грамматические: в оглавлениях колонки «Grammar» нет вообще, поэтому тем для сравнения они не дали (именно ими оказались бывшие «непрочитанные» файлы `1–6.pdf`).
- **Атлас NotebookLM** — сводная карта тем A1–C2.

**Ограничение охвата (обновлено 2026-07-23).** Прежде файлы `1–6.pdf` и учебники Intermediate / Upper-Intermediate / Advanced (SB+WB) числились фотосканами без текстового слоя и учитывались только косвенно. Теперь OCR снят:
- `1–6.pdf` оказались серией **«4000 Essential English Words 1–6»** (Paul Nation) — словарные курсы без грамматического синтабуса, для gap-сравнения нерелевантны.
- **Intermediate / Upper-Intermediate / Advanced (SB+WB)** прочитаны напрямую по OCR-оглавлениям. Это заметно повысило уверенность в пробелах B1–C1 и дало вторые/третьи источники для многих уже перечисленных тем (state verbs, indirect questions, determiners, dependent prepositions, mixed conditionals, future in the past, ellipsis, reduced infinitives, discourse markers, distancing passive, shall). Уровневое соответствие серии: Intermediate ≈ B1(–B2), Upper-Intermediate ≈ B2(–C1), Advanced ≈ C1(–C2).

Косвенно (только через атлас) остался лишь **EFE Everyday English**.

**Как чистились данные.** Одна тема числится пробелом только на одном (наиболее подходящем) уровне — межуровневые дубли сведены. Убраны ложные пробелы: темы, которые есть у нас под другим названием (напр. Reported speech = «Косвенная речь», уроки 39/49; Modal speculation about the past = урок 46). Инверсия и cleft-предложения у нас на C1 (уроки 53, 55) — это не пробелы, хотя в части книг они на B2. Новые пробелы из OCR-сверки перепроверены по `our-lessons.txt` и по самому отчёту — дубли и темы под другим названием не добавлялись.

---

## Итоговая таблица

| Уровень | Тем в книгах (≈) | Закрыто | Частично | Пробелов |
|---------|:----------------:|:-------:|:--------:|:--------:|
| A1 | ~20 | 12 | 1 | 8 |
| A2 | ~28 | 14 | 3 | 11 |
| B1 | ~30 | 14 | 4 | 12 |
| B2 | ~28 | 12 | 3 | 13 |
| C1 | ~19 | 8 | 2 | 9 |
| **Итого** | **~125** | **60** | **13** | **53** |

Пробелы по приоритету: **🔴 критично — 12 · 🟡 желательно — 21 · ⚪ опционально — 20.**

> Прирост к прошлой версии (40 → 53 пробелов) — 13 новых тем, найденных при OCR-сверке Headway Intermediate / Upper-Intermediate / Advanced. Все помечены «(уточнено по OCR)».

---

## A1 (у нас 12 уроков, 1–12)

### Пробелы

- 🔴 **Wh-вопросы: what / where / who / when / why / how / how many / how much.** New Headway Elementary WB (Unit 2), Pre-Intermediate SB. У нас разобраны только yes/no-вопросы с do/does (урок 6); построение открытых вопросов — фундамент любых расспросов — не преподаётся ни на одном уровне. (уточнено по OCR: intermediate-sb Unit6 «Information questions», intermediate-wb Unit6 «Question forms».)
- 🔴 **Наречия частотности: always, usually, often, sometimes, never (+ место в предложении).** New Headway Elementary SB/WB, EFE Guide, атлас (5 источников). Обычно идут в паре с Present Simple. У нас нет ни одного урока с наречиями частотности во всём курсе A1–C1.
- 🔴 **Притяжательный падеж 's (Saxon genitive): my sister's name, the teacher's book (+ mine/yours/hers).** New Headway Elementary SB/WB, EFE Guide. У нас есть только притяжательные прилагательные my/your/his (урок 2); сама конструкция 's и местоимения mine/yours не разбираются нигде. (уточнено по OCR: intermediate-sb/wb Unit10 «Possessives».)
- 🟡 **Краткие ответы (short answers): Yes, I do / No, I don't; So do I / Neither am I.** *(уточнено по OCR: intermediate-sb Unit1 «Short answers», intermediate-wb Unit1 «Auxiliary verbs — questions, negatives, short answers».)* Отдельно не разбираются; логически примыкают к уроку 6.
- 🟡 **Повелительное наклонение (Imperatives): Open the door, Don't touch.** EFE Guide, атлас. Базовая структура, отдельным уроком отсутствует.
- 🟡 **Базовые сочинительные союзы: and, but, so, because.** New Headway Elementary WB (Unit 1). Простейшие связки для A1 не разбираются; союзы у нас впервые появляются лишь на B2 (although/despite/however, урок 51).
- ⚪ **Прилагательные: порядок слов и противоположности (big/small, hot/cold).** New Headway Elementary WB, EFE Guide. Скорее лексико-грамматическая тема. (уточнено по OCR: advanced-sb Unit2 «Adjective order» — та же тема повторяется на продвинутом уровне с тонкими случаями opinion-size-age-shape-colour-origin-material; если делать урок, стоит заложить оба уровня сложности.)
- ⚪ **Числительные: количественные и порядковые.** EFE Guide. В основном лексика.

### Частично закрыто

- **Урок 10 «Can — умею, могу».** Добавить наречия степени с can: quite well, very well, not at all (She can ski very well; I can't speak French at all). Источник: New Headway Elementary SB.

---

## A2 (у нас 14 уроков, 13–26)

### Пробелы

- 🔴 **Could — умение в прошлом (past ability): I could ski when I was five.** New Headway Elementary SB/WB, EFE Level 2. У нас есть только Can (настоящее, урок 10); could для умения в прошлом нет нигде (в уроке 35 could — только про совет/вероятность).
- 🔴 **Исчисляемые и неисчисляемые существительные (tea/cheese vs apples/eggs).** New Headway Elementary SB/WB, Pre-Int WB, EFE Guide, атлас (5 источников). У нас есть Some/any/much/many (урок 23), но само деление на countable/uncountable как понятие не объясняется. (уточнено по OCR: upper-wb Unit6 «Countable and uncountable nouns».)
- 🔴 **Неопределённые местоимения: something, nothing, somebody, nobody, anything, everywhere.** New Headway Elementary SB/WB, EFE Guide, атлас (4 источника). Полностью отсутствуют во всех 60 уроках. (уточнено по OCR: upper-wb Unit6 «Compounds with some, any, no, every».)
- 🟡 **Модальные разрешения: can / could / be allowed to (просить и давать разрешение).** *(A2–B1; уточнено по OCR: intermediate-sb Unit4 «Advice, obligation, and permission», intermediate-wb Unit4 «Permission and ability — can and be allowed to».)* Отдельная функция «разрешение»; отличать от could-умения и от should/could/might (урок 35).
- 🟡 **Возвратные и взаимные местоимения: myself, yourself, themselves, each other.** EFE Guide, атлас. Отсутствуют во всём курсе. (уточнено по OCR: intermediate-sb/wb Unit10 «Reflexive pronouns and each other», advanced-sb Unit1 «Reflexive pronouns».)
- 🟡 **Инфинитив цели (to + verb): «to see the pyramids».** New Headway Elementary SB/WB. Конструкция цели действия не встречается нигде.
- 🟡 **Сравнение на равенство: as … as («as hot as Dubai»).** New Headway Pre-Int SB/WB. У нас есть сравнительная и превосходная степень (уроки 21–22), но as…as нет.
- 🟡 **Was born: «he was born in 1990».** New Headway Elementary SB, EFE Level 2. Частая пассивная конструкция для биографий; Past Simple (уроки 14–16) её не затрагивает явно.
- 🟡 **Маркеры прошедшего времени как блок: ago, yesterday morning, last night.** New Headway Elementary SB/WB, Pre-Int WB, EFE Level 2 (4 источника). Отдельного урока про временные маркеры нет. (уточнено по OCR: intermediate-wb Unit3 «time expressions».)
- ⚪ **A few / a little — с исчисляемыми и неисчисляемыми.** New Headway Pre-Int WB. Тонкое разграничение поверх much/many/a lot of (урок 23). (уточнено по OCR: upper-sb Unit6 «Expressions of quantity: a few, a little, plenty of, hardly any».)
- ⚪ **Have a + noun: have a shower, have a look, have a break.** New Headway Elementary WB. Идиоматичные коллокации, один источник.

### Частично закрыто

- **Урок 17 «Present Continuous: происходит сейчас».** Добавить второе значение — будущие договорённости: «What are you doing this evening?». Источник: New Headway Pre-Int SB/WB. (уточнено по OCR: intermediate-wb Unit5 и upper-wb Unit5 «Present Continuous for arrangements».)
- **Урок 24 «Must и have to».** Добавить прошедшую форму: had to / didn't have to (в Pre-Int WB это отдельный пункт). (уточнено по OCR: intermediate-wb Unit4 «mustn't / don't have to / didn't have to».)
- **Урок 26 «Like doing, want to do, would like».** Явно противопоставить I like (предпочтение) vs I'd like (вежливая просьба) + паттерн looking forward to doing. Источник: New Headway Pre-Int SB.

---

## B1 (у нас 14 уроков, 27–40)

### Пробелы

- 🔴 **Фразовые глаголы (phrasal verbs): get up, turn on, take off, get married; разделяемые/неразделяемые.** New Headway Elementary SB/WB, EFE Guide. Ни одного урока про phrasal verbs во всём курсе A1–C1.
- 🔴 **Подчинительные связки: because, so, when, until, while, before, as.** New Headway Elementary/Pre-Int SB, EFE Guide. У нас только продвинутые although/despite/however на B2 (урок 51); базовых связок нет. (уточнено по OCR: upper-wb Unit5 «Conjunctions in time clauses».)
- 🔴 **Глаголы состояния vs действия (stative vs action): know, want, believe не в Continuous.** EFE Guide, EFE Level 2, атлас. Важно для верного выбора Simple/Continuous; у нас есть «Present Simple или Continuous?» (урок 18), но сами stative-глаголы отдельно не разбираются. (уточнено по OCR: intermediate-sb Unit2 «State verbs».)
- 🔴 **-ed / -ing прилагательные: bored/boring, interested/interesting, tired/tiring.** *(уточнено по OCR: intermediate-wb Unit6 «-ed / -ing adjectives».)* Частая ошибка русскоговорящих (I'm boring вместо I'm bored); отдельным уроком отсутствует.
- 🔴 **be used to / get used to (привыкнуть) — в отличие от used to (раньше делал).** *(B1–B2; уточнено по OCR: upper-sb Unit9 «Expressing habit: be used to», upper-wb Unit9 «Present and past habit — get and be used to».)* Соседняя, но самостоятельная тема рядом с уроком 36; их нужно чётко развести, иначе ученик путает «раньше делал» и «привык делать».
- 🟡 **So/such и too/enough (интенсификаторы и избыточность).** EFE Guide, атлас. Полностью отсутствуют.
- 🟡 **Вопрос к подлежащему vs к дополнению: Who saw you? / Who did you see?** EFE Level 2, атлас. Различие не разбирается.
- 🟡 **Косвенные (встроенные) вопросы: Could you tell me where…?** EFE Guide, атлас. У нас есть косвенная речь-вопросы на B2 (урок 49), но это другой аспект — вежливый словопорядок как самостоятельная структура не отрабатывается. (уточнено по OCR: upper-wb Unit4 «indirect questions».)
- ⚪ **Модальный shall для предложений: Shall we…?** New Headway Elementary WB. (уточнено по OCR: upper-sb Unit5 «Future forms: will, going to, shall» — второй источник.)
- ⚪ **looks like / looks + прилагательное (различие конструкций): It looks like rain / It looks nice.** *(уточнено по OCR: intermediate-sb Unit11 «looks like / looks».)* Примыкает к уроку 38.
- ⚪ **Прилагательное + инфинитив: easy to understand, happy to help, difficult to explain.** *(уточнено по OCR: intermediate-sb Unit8 «Verb patterns: adjective + infinitive».)* Примыкает к уроку 38.
- ⚪ **Present Simple для расписаний/программ: the train leaves at 9, the film starts at 8.** *(B1–B2; уточнено по OCR: upper-sb Unit5 «Future forms: is staying; leaves».)* Примыкает к уроку 5.

### Частично закрыто

- **Урок 36 «Used to».** Добавить пару would для повторяющихся привычек в прошлом — книги (атлас, EFE Guide) всегда дают used to и would вместе. (уточнено по OCR: upper-wb Unit9 «used to and would».)
- **Урок 37 «Who, which, that».** Добавить relative pronoun where (the place where). New Headway Elementary SB даёт триаду who/which/where.
- **Урок 28 «Present Perfect: ever/never/just/already/yet».** Добавить been vs gone (she's been to Paris / she's gone to Paris). New Headway Elementary WB выделяет отдельно.
- **Уроки 19–20 (going to / will).** Добавить сопоставление трёх способов будущего с Present Continuous for arrangements (will vs going to vs Present Continuous). New Headway Pre-Int WB — как отдельная тема выбора формы. (уточнено по OCR: intermediate-sb/wb Unit5 «Future forms».)

---

## B2 (у нас 12 уроков, 41–52)

### Пробелы

- 🔴 **Past Perfect Continuous: I had been doing.** EFE Grammar Guide (B2). Базовое время уровня, парное к уже пройденному Present Perfect Continuous (урок 41), но отсутствует полностью.
- 🟡 **Смешанные условные (Mixed Conditionals): If I had studied medicine, I'd be a doctor now.** EFE Guide, атлас. У нас есть Zero/First/Second/Third по отдельности (уроки 32–33, 44), смешение времён не разбирается. (уточнено по OCR: advanced-sb Unit7 «Mixed conditionals».)
- 🟡 **Future in the Past: would / was going to для «будущего из прошлого» (He said he would call).** EFE Guide, EFE Level 2, атлас. Отдельная конструкция; частично пересекается с уроком 58 (см. C1), но там would — только про привычки. (уточнено по OCR: advanced-sb Unit11 «Future in the past».)
- 🟡 **Reporting verbs с особыми паттернами: suggest doing, deny doing, recommend that, insist.** EFE Guide. Наша косвенная речь (уроки 39, 49) разбирает backshift и общие вопросы/просьбы, а глаголы с нестандартным управлением — нет. (уточнено по OCR: intermediate-wb Unit8 «Reporting verbs + infinitive» — в Headway идут рядом с герундий/инфинитив, есть смысл расширить урок 38, а не заводить отдельный.)
- 🟡 **Детерминативы: each/every, either/neither/both, no/none.** EFE Guide (три темы), атлас. Не встречаются нигде. (уточнено по OCR: upper-sb/wb Unit12 «Determiners».)
- 🟡 **would rather (+ прошедшее для гипотетического настоящего / + инфинитив без to для предпочтения).** *(уточнено по OCR: upper-sb Unit11 «Hypothesizing: wish, would rather, if only».)* Примыкает к уроку 45 (wish / if only).
- 🟡 **Условные слова кроме if: unless, provided (that), as long as, otherwise, suppose/imagine.** *(уточнено по OCR: upper-wb Unit11 «Ways of introducing conditionals — words other than if».)* Дополняет уроки 32–33, 44.
- ⚪ **Gradable vs non-gradable adjectives + интенсификаторы (absolutely huge vs very big).** EFE Guide. Один источник.
- ⚪ **Двойные сравнительные: the more … the more, increasingly.** EFE Guide. Один источник.
- ⚪ **Вводное it: It is + прилагательное + that.** EFE Guide. Один источник.
- ⚪ **Зависимые предлоги (глагол/прилагательное + фиксированный предлог).** EFE Guide. Скорее лексическая тема. (уточнено по OCR: upper-wb Units 4, 6, 8, 10 «Prepositions».)
- ⚪ **Continuous infinitive: must be doing, seems to be working, may be joking.** *(уточнено по OCR: intermediate-wb Unit11 «Continuous infinitive».)*
- ⚪ **Согласование сказуемого в сложных случаях (each of, the number of).** EFE Guide. Тонкие случаи, один источник.

### Частично закрыто

- **Урок 47 «Пассив во всех временах».** Добавить сочетание модальных с пассивом: must be done, could have been prevented. Источник: EFE Guide «Passive Voice with Modals».
- **Урок 50 «Relative clauses: запятые меняют смысл».** Добавить сложные конструкции с предлогами и whose (the man to whom I spoke, the reason for which). Источник: EFE Guide «Relative Clauses: Advanced Structures». (уточнено по OCR: upper-wb Unit8 «prepositions in relative clauses», «all relative pronouns».)
- **Урок 35 «Should, could, might».** Добавить устойчивые обороты вероятности для будущего: likely to, bound to, certain to. Источник: EFE Guide «Future Possibilities». (уточнено по OCR: upper-sb Unit7 «bound to».)

---

## C1 (у нас 8 уроков, 53–60)

### Пробелы

- 🟡 **Эллипсис и слова-заместители (Ellipsis & Substitution): so/not, do so, one.** EFE Guide («Substitution»), атлас. Два источника, характерная тема продвинутого синтаксиса; отсутствует. (уточнено по OCR: advanced-sb Unit5 «Missing words out».)
- 🟡 **Продвинутые дискурсивные маркеры (Linking Words Advanced): nevertheless, whereas, moreover.** EFE Guide (C1). У нас only although/despite/however на B2 (урок 51); широкий набор коннекторов C1 отдельно не собран. (уточнено по OCR: advanced-sb Unit9/12 «Discourse markers: Connectors», «Linking devices».)
- 🟡 **Наречия с двумя формами и разным значением: hard/hardly, late/lately, near/nearly, high/highly.** *(уточнено по OCR: advanced-sb Unit2 «Adverbs and adjectives: Adverbs with two forms».)* Частая путаница значений; отсутствует.
- ⚪ **Сокращённый инфинитив (Shortening Infinitives): I'd like to, He refused to, She asked me not to.** EFE Guide, атлас. Узкая стилистическая тема. (уточнено по OCR: advanced-sb Unit5 «Reduced infinitives».)
- ⚪ **Дистанцирующий пассив: It is said that…, He is believed to have…** Атлас. Нишевая академическая конструкция. (уточнено по OCR: advanced-sb Unit10 «Distancing the facts: Passive constructions».)
- ⚪ **Сослагательное наклонение в формальном стиле: It is essential that he be present.** Атлас. Формальный регистр.
- ⚪ **Эмфатическое do / does / did для усиления утверждения: I DO like it, She DID call.** *(уточнено по OCR: advanced-sb Unit6 «Ways of adding emphasis: Emphatic do, does, did».)*
- ⚪ **Attitude adverbs — маркеры отношения говорящего: frankly, apparently, surprisingly, obviously.** *(уточнено по OCR: advanced-sb Unit9 «Discourse markers: Attitude adverbs».)* Отличать от линкеров-коннекторов (см. дискурсивные маркеры выше) — это наречия отношения говорящего, а не связки.
- ⚪ **Место наречия в предложении и устойчивые сочетания наречий.** Атлас. Тонкая стилистическая тема. (уточнено по OCR: intermediate-wb Unit6 «Position of adverbs» — тема встречается уже на уровне Intermediate, не только C1.)

### Частично закрыто

- **Урок 60 «However hard he tried…».** У нас разобрано только however + прилагательное/наречие для уступки. Добавить всю семью слов на -ever как свободные относительные (whoever comes is welcome; take whatever you need; whenever/wherever/whichever). Источник: EFE Guide «Question Words with -Ever», атлас.
- **Урок 58 «Would и will: привычки и характер».** Would разбирается только как привычка/черта в прошлом. Пересказанное will в косвенной речи о будущем (He said he would call tomorrow) сведено в пробел Future in the Past на B2 — здесь оставлена перекрёстная ссылка. Источник: атлас, EFE Level 2.

---

## Топ-10 рекомендуемых новых уроков (в порядке приоритета)

1. **A1 — Wh-вопросы (what/where/who/when/why/how much).** Схема слово-вопроса + порядок (Wh + do/does/is + подлежащее). Основа любых расспросов; сейчас есть только yes/no-вопросы.
2. **A1 — Наречия частотности (always/usually/often/sometimes/never).** Значения по шкале + место в предложении (перед смысловым глаголом, после to be). Идёт в паре с Present Simple; всплывает в 5 источниках.
3. **A2 — Исчисляемые и неисчисляемые существительные.** Понятие countable/uncountable, a/an только с исчисляемыми, подводка к some/any/much/many (урок 23). 5 источников.
4. **A2 — Неопределённые местоимения (something / anything / nothing / somebody / nowhere).** Таблица some-/any-/no-/every- × -thing/-body/-where + употребление в +/–/?. Отсутствуют во всём курсе.
5. **A1 — Притяжательный падеж 's + mine/yours/hers.** the teacher's book, 's vs of, апостроф во мн. числе; притяжательные местоимения. Дополняет урок 2.
6. **B1 — Фразовые глаголы.** Частотные get up/turn on/take off/get on with, разделяемые vs неразделяемые, буквальные vs идиоматичные. Полностью отсутствуют.
7. **B1 — Подчинительные связки (because/so/when/while/until/before/as).** Заполняет разрыв между простыми and/but (A1) и although/however (B2).
8. **A2 — Could — умение в прошлом.** could/couldn't для past ability + расширение can наречиями степени (very well / at all). Закрывает и частичный пробел урока 10.
9. **B1 — Глаголы состояния vs действия.** Список stative-глаголов (know/want/like/believe), почему не в Continuous — усиливает урок 18.
10. **B1 — -ed / -ing прилагательные (bored/boring).** Критичная и очень частая ошибка русскоговорящих; выявлена OCR-сверкой (intermediate-wb Unit6). В тот же блок логично дать be used to / get used to как отдельную тему рядом с уроком 36.
