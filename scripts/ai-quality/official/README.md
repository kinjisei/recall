# Официальные работы IELTS с баллом экзаменатора — эталон оценки письма

Журнал п.77 (Ф2.20): балл, который ставит наш экзаменатор (`gradeWriting`),
сверяется не с нашей догадкой, а с баллом настоящего экзаменатора IELTS.
`check-ai-writing` берёт отсюда эссе и меряет: каждое — в ±0,5 от
официального балла (П6), а в среднем по набору AI не завышает и не занижает
больше чем на 0,25 (П11).

**Тексты в git не лежат** (`.gitignore`): это чужие тексты (IELTS — British
Council, IDP, Cambridge), а репозиторий открытый. Здесь — откуда они и как
собрать файл заново.

## Откуда

Официальные «Sample Candidate Writing Scripts and Examiner Comments» —
рукописные работы, у каждой балл и комментарий экзаменатора:

| Набор | Файл | Что взято |
|---|---|---|
| `new` | https://languageadvisor.net/wp-content/uploads/2021/06/ac-writing-sample-materials-and-examiner-comments.pdf | Academic Task 2A (баллы 4; 6,5; 8), 2B (5; 7) |
| `old` | https://exams.ru/content/files/113313_AC_sample_scripts.pdf | Academic Task 2A (5; 6), 2B (5; 7) |
| `gt` | https://languageadvisor.net/wp-content/uploads/2021/06/115004_general_training_writing_sample_scripts.pdf | GT Task 1 — письмо (5; 7), GT Task 2 (5; 8) |

Тексты заданий — из официальных Specimen Materials
(`https://languageadvisor.net/wp-content/uploads/2024/06/{AC_W_Sample_Task_2A,AC_W_Sample_Task_2B,GT_W_Sample_Task_1,GT_W_Sample_Task_2}.pdf`);
у набора `new` — копии с writing9.com (на ielts.org не нашлись).

## Как собрано (04.11.2026)

Страницы PDF → картинки (PyMuPDF), перепечатка воркером на Sonnet **как
написано**, со всеми ошибками автора; зачёркнутое пропущено, вставленное над
строкой — на месте «галочки»; сомнительные слова Claude сверил выборочно с
картинкой. `gt-t2-A` помечено `skip`: начало скана потеряно, а балл
экзаменатор ставил за целый текст.

Файл `essays.json` — массив: `id`, `set`, `task` (`academic-task2` ·
`gt-task1` · `gt-task2`), `band`, `prompt`, `promptSource`, `essay`,
`words`, `examinerComment`, `notes`, `skip`.

## Чего в наборе нет

Academic Task 1 (графики): данные графиков в PDF — картинкой, а
приложение получает график данными (`chart`), — их проверяют наши примеры
(`examples/writing.mjs`). Баллов ниже 4 и 9 за эссе тоже нет.
