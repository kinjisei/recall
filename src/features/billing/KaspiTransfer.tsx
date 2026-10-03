// ============================================================================
// «Перевод на Kaspi Gold» (макет t9-4): кому, куда, сколько и что написать в
// сообщении. Код в сообщении — личный код человека: по нему владелец находит
// его в админке; забыл код — сверят по имени отправителя.
// ============================================================================
import { useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { IconCheck, IconCopy, IconHint } from '../../shared/ui/icons'
import { useCopy } from '../../shared/lib/useCopy'
import { KASPI } from '../../domains/billing'

const money = (n: number) => `${n.toLocaleString('ru-RU')} ₸`

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-tint/[0.08] py-3 last:border-b-0">
      <span className="text-sm text-fg-muted">{label}</span>
      {/* значение выделяется целиком — если буфер недоступен, копируют руками */}
      <span className={`select-all text-right text-sm ${strong ? 'font-medium tracking-wide text-fg' : 'text-fg'}`}>
        {value}
      </span>
    </div>
  )
}

export function KaspiTransfer({ amount, code }: { amount: number; code: string }) {
  const { copied, copy } = useCopy()
  // буфер недоступен (старый браузер, запрет) — подсказать скопировать руками
  const [failed, setFailed] = useState(false)

  const copyOne = async (key: string, text: string) => {
    setFailed(!(await copy(key, text)))
  }

  return (
    <Card>
      <h2 className="font-medium">Перевод на Kaspi Gold</h2>
      <div className="mt-2">
        <Row label="Получатель" value={KASPI.name} />
        <Row label="Номер" value={KASPI.phone} />
        <Row label="Сумма" value={money(amount)} />
        <Row label="Сообщение к переводу" value={code} strong />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="min-h-11 text-sm" onClick={() => copyOne('phone', KASPI.phone.replace(/\s/g, ''))}>
          {copied === 'phone' ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {copied === 'phone' ? 'Скопирован' : 'Номер'}
        </Button>
        <Button variant="secondary" className="min-h-11 text-sm" onClick={() => copyOne('code', code)}>
          {copied === 'code' ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {copied === 'code' ? 'Скопирован' : 'Код'}
        </Button>
      </div>
      {failed && (
        <p className="mt-2 text-note text-fg-muted">Не получилось скопировать — нажми на номер или код и скопируй вручную.</p>
      )}

      <p className="mt-3 flex gap-2 text-note text-fg-muted">
        <IconHint size={16} className="mt-0.5 flex-none text-fg-faint" />
        <span>
          Впиши код {code} в сообщение к переводу — так мы поймём, что оплата от тебя. Забыл — не страшно: сверим по
          имени отправителя.
        </span>
      </p>
    </Card>
  )
}

