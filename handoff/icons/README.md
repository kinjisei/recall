# Иконки Recall (57 шт.)

Единый набор: viewBox 0 0 24 24, поле 20x20, stroke 1.75px, round caps/joins,
stroke="currentColor", fill только в *-fill вариантах (currentColor, opacity .32, stroke 2px — активная вкладка)
для активных вкладок. spinner вращать через CSS (animation: spin 1s linear infinite).

Интеграция: завести все в src/components/icons.tsx как React-компоненты
(имя файла -> PascalCase, например speaker-slow.svg -> IconSpeakerSlow),
затем заменить Phosphor по всему приложению правкой одного файла.

Список: trash, close, cards, caret-down, package, tray, eye, home, home-fill, practice, practice-fill, study, study-fill, speech, speech-fill, dialog, dialog-fill, speaker, speaker-slow, mic, mic-fill, stop, spinner, check, arrow-right, arrow-up, refresh, search, plus, hint, send, back, gear, sign-out, chart, flame, sparkle, trophy, thumbs-up, badge-check, warning, meaning, gap, translate, headphones, timer, keyboard, puzzle, mcq, pencil, rows, shuffle, teacher, students, materials, graduation, printer
