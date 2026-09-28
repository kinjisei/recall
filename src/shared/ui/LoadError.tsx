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
    <Card className="flex flex-col items-center gap-3 border-red-400/30 bg-red-500/[0.07] text-center">
      <IconWarning size={28} className="text-red-300" />
      <div>
        <p className="font-medium">{message}</p>
        <p className="mt-1 text-sm text-[var(--night-text-40)]">
          Проверь соединение — данные не потеряны.
        </p>
      </div>
      <Button variant="secondary" className="min-h-[44px] px-4 text-sm" onClick={onRetry}>
        <IconRefresh size={16} /> Повторить
      </Button>
    </Card>
  )
}
