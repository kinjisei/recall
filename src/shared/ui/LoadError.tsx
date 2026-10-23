// Плашка «не удалось загрузить» с повтором — статусная карточка листа s3:
// иконка, заголовок danger-strong, пояснение и одно действие. Показывается
// вместо пустого состояния, чтобы сбой сети не выглядел как «данных нет».
import { IconAlert } from './icons'
import { BoltText } from './Bolt'
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
    <Card tone="danger" className="flex gap-3">
      <IconAlert size={20} className="mt-px flex-none text-danger-strong" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="font-semibold text-danger-strong">
          <BoltText>{message}</BoltText>
        </p>
        <p className="text-body text-fg-secondary">Проверь соединение — данные не потеряны.</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    </Card>
  )
}
