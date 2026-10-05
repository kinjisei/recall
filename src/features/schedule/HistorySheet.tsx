// ============================================================================
// «История уроков и оплат» карточки (макет t7-2): сверху остаток и «Отметить
// оплату», ниже — по месяцам: «Оплата 29 сен · отмечена тобой +8», «Проведён
// сб, 10 окт · 11:00 · списан −1», «Пробный урок · без списания 0».
// Нажатие на запись — исправить задним числом (FixRecordSheet). Страницами по
// 50 — «Показать более ранние».
// ============================================================================
import { useState } from 'react'
import {
  balanceLabel,
  historyMonth,
  historyRow,
  loadCardHistory,
  type HistoryItem,
  type LessonBalance,
} from '../../domains/schedule'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { IconClose } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'
import { FixRecordSheet } from './FixRecordSheet'

const PAGE = 50
const deltaText = (d: number | null) => (d === null ? '—' : d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '0')

export function HistorySheet({
  cardId,
  name,
  balance,
  today,
  now,
  canWrite,
  onClose,
  onPay,
  onChanged,
}: {
  cardId: string
  name: string
  balance: LessonBalance | null
  today: string
  now: Date
  canWrite: boolean
  onClose: () => void
  onPay: () => void
  /** Исправили запись — перечитать остаток снаружи. */
  onChanged: () => void
}) {
  const [version, setVersion] = useState(0)
  const first = useAsyncData(() => loadCardHistory(cardId, undefined, PAGE), [cardId, version], 'Не удалось загрузить историю')
  const [more, setMore] = useState<HistoryItem[]>([])
  const [moreBusy, setMoreBusy] = useState(false)
  const [end, setEnd] = useState(false)
  const [fix, setFix] = useState<HistoryItem | null>(null)
  const items = [...(first.data ?? []), ...more]
  const hasMore = !end && (first.data?.length ?? 0) === PAGE

  const loadMore = async () => {
    const last = items[items.length - 1]
    if (!last) return
    setMoreBusy(true)
    try {
      const page = await loadCardHistory(cardId, last.at, PAGE)
      setMore((m) => [...m, ...page])
      if (page.length < PAGE) setEnd(true)
    } finally {
      setMoreBusy(false)
    }
  }

  // по месяцам, порядок записей сохраняется
  const months: { title: string; rows: HistoryItem[] }[] = []
  for (const h of items) {
    const title = historyMonth(h, today)
    const lastMonth = months[months.length - 1]
    if (lastMonth?.title === title) lastMonth.rows.push(h)
    else months.push({ title, rows: [h] })
  }

  return (
    <Sheet onClose={onClose} labelledBy="history-title" maxH="92dvh">
      <div className={SHEET_BODY}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="history-title" className="text-lg font-semibold">
              История
            </h2>
            <p className="truncate text-sm text-fg-secondary">{name} · уроки и оплаты</p>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-tint/[0.08] px-4 py-3">
          <span className="text-sm font-semibold">{balanceLabel(balance)}</span>
          {canWrite && (
            <Button variant="secondary" className="min-h-11 flex-none px-3 py-2 text-sm" onClick={onPay}>
              Отметить оплату
            </Button>
          )}
        </div>

        {first.error && !first.data ? (
          <LoadError message={first.error} onRetry={first.reload} />
        ) : !first.data ? (
          <RowsSkeleton count={4} height={56} />
        ) : items.length === 0 ? (
          <p className="text-sm text-fg-muted">Пока пусто: здесь будут оплаты и прошедшие уроки.</p>
        ) : (
          <>
            {months.map((m) => (
              <section key={m.title} aria-label={m.title} className="flex flex-col gap-1.5">
                <h3 className="text-note font-semibold text-fg-muted">{m.title}</h3>
                <ul className="divide-y divide-tint/[0.06] overflow-hidden rounded-2xl border border-tint/[0.08]">
                  {m.rows.map((h) => {
                    const r = historyRow(h)
                    const tappable = canWrite && r.fix !== null
                    return (
                      <li key={`${h.item}-${h.id}`}>
                        <button
                          type="button"
                          disabled={!tappable}
                          onClick={() => setFix(h)}
                          data-history-row={h.item}
                          className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-tint/[0.04] disabled:hover:bg-transparent"
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">{r.title}</span>
                            <span className="truncate text-note text-fg-muted">{r.detail}</span>
                          </span>
                          <span
                            className={`flex-none text-sm font-bold tabular-nums ${
                              (r.delta ?? 0) > 0 ? 'text-success-strong' : (r.delta ?? 0) < 0 ? 'text-fg' : 'text-fg-muted'
                            }`}
                          >
                            {deltaText(r.delta)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            {hasMore && (
              <Button variant="ghost" className="w-full" loading={moreBusy} onClick={() => void loadMore()}>
                Показать более ранние
              </Button>
            )}
            {canWrite && <p className="text-center text-note text-fg-muted">Нажми на запись, чтобы исправить её задним числом.</p>}
          </>
        )}
      </div>
      {fix && (
        <FixRecordSheet
          cardId={cardId}
          item={fix}
          balance={balance}
          now={now}
          onClose={() => setFix(null)}
          onFixed={() => {
            setFix(null)
            setMore([])
            setEnd(false)
            setVersion((v) => v + 1)
            onChanged()
          }}
        />
      )}
    </Sheet>
  )
}
