// ============================================================================
// Сохранить файл, собранный в браузере («Выгрузить мои данные», Настройки):
// ссылка на Blob с download и клик по ней. Ссылку освобождаем не сразу —
// иначе Safari успевает отменить скачивание.
// ============================================================================

export function saveFile(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
