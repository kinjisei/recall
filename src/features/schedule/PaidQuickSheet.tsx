// ============================================================================
// «<имя> теперь занимается · Отметить оплату?» (журнал п.30: после «Да» на
// пробном можно сразу отметить оплату; макет t7-4). Одно нажатие на «+8» —
// и готово; своё число — полем. Только число уроков, без сумм (журнал п.29).
// Полный учёт (история, исправления, «Напомнить») — Ф2.8.
// ============================================================================
import { useState } from 'react'
import { addPaidLessons } from '../../domains/schedule'
import { Button } from '../../shared/ui/Button'
import { IconClose } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'

const QUICK = [4, 8, 12]

export function PaidQuickSheet({
  cardId,
  name,
  onClose,
  onPaid,
}: {
  cardId: string
  name: string
  onClose: () => void
  onPaid: (count: number) => void
}) {
  const [own, setOwn] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ownCount = Number(own)
  const ownOk = Number.isInteger(ownCount) && ownCount >= 1 && ownCount <= 100

  const save = async (count: number) => {
    setBusy(count)
    setError(null)
    try {
      await addPaidLessons(cardId, count)
      onPaid(count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить оплату')
      setBusy(null)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="paid-quick-title">
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="paid-quick-title" className="text-lg font-semibold">
              {name} теперь занимается
            </h2>
            <p className="text-sm text-fg-secondary">Отметить оплату? Сколько уроков оплачено</p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((n) => (
            <Button key={n} variant="secondary" className="min-h-12 text-base" loading={busy === n} disabled={busy !== null} onClick={() => void save(n)}>
              +{n}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (ownOk) void save(ownCount)
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Своё число уроков</span>
            <input
              inputMode="numeric"
              value={own}
              onChange={(e) => setOwn(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Своё число"
              className="min-h-12 w-full rounded-xl bg-input px-3 text-base ring-1 ring-control-line outline-none focus:ring-2 focus:ring-accent-line"
            />
          </label>
          <Button type="submit" variant="secondary" className="min-h-12 px-4 text-sm" disabled={!ownOk || busy !== null} loading={busy === ownCount && ownOk}>
            Отметить
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-danger-soft-fg">
            {error}
          </p>
        )}
        <Button variant="ghost" className="min-h-11 text-sm" onClick={onClose} disabled={busy !== null}>
          Позже
        </Button>
        <p className="text-center text-note text-fg-muted">Recall хранит только число уроков, без сумм</p>
      </div>
    </Sheet>
  )
}
