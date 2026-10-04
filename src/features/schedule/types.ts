// Общие типы шторок расписания: что вернуть экрану после действия.

/** Действие сделано: тост, куда перейти, «Вернуть», кому написать. */
export interface Done {
  toast: string
  /** Показать этот день (новый урок, перенос). */
  day?: string
  /** «Вернуть» в тосте. */
  undo?: () => Promise<void>
  /** «Сообщи ученику» (t5-4): кому и что — по имени. */
  tell?: {
    title: string
    cardIds: string[]
    text: (firstName: string) => string
    /** Ссылка урока — в сообщение Telegram; нет — адрес Recall. */
    url?: string | null
  }
}
