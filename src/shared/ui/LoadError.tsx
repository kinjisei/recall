// Плашка «не удалось загрузить» с повтором. Показывается вместо пустого
// состояния, чтобы сбой сети не выглядел как «данных нет».
import { IconRefresh, IconWarning } from './icons'
import { Card } from './Card'
import { Button } from './Button'

export function LoadError({
  message = 'Не удалось загрузить данные',
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <Card tone="danger" className="flex flex-col items-center gap-3 text-center">
      <IconWarning size={28} className="text-danger-strong" />
      <div>
        <p className="font-medium">{message}</p>
        <p className="mt-1 text-sm text-fg-muted">
          Проверь соединение — данные не потеряны.
        </p>
      </div>
      <Button variant="secondary" className="min-h-11 px-4 text-sm" onClick={onRetry}>
        <IconRefresh size={16} /> Повторить
      </Button>
    </Card>
  )
}
