// Текст, к которому упражнения правятся и заменяются: слова «из текста»,
// кнопки True / False по языку и уровню. Отдельным файлом — его берут и
// список, и его части (кнопки, замена через AI), без циклического импорта.
import type { AppLang } from '../../../../types'

export interface EditText {
  body: string
  lang: AppLang
  level: string
}
