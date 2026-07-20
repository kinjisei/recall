// Форма ручного добавления слова. Живёт на уровне хаба «Слова»: добавление
// не относится к режиму повторения, а нужно из любого места раздела.
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { addCard } from '../../lib/cards'
import type { AppLang } from '../../types'

export function AddCardForm({ lang, onAdded }: { lang: AppLang; onAdded: () => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const inputClass =
    'w-full rounded-lg border border-white/[0.10] bg-[var(--night-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)] dark:border-white/[0.10] dark:bg-slate-900'

  const submit = async () => {
    if (!front.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await addCard({
        front: front.trim(),
        back: back.trim() || undefined,
        example: example.trim() || undefined,
        lang,
        source: 'manual',
      })
      setFront('')
      setBack('')
      setExample('')
      setMsg('Добавлено ✓')
      onAdded()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <input
        className={inputClass}
        placeholder={lang === 'es' ? 'Слово / фраза (исп.)' : 'Слово / фраза (англ.)'}
        value={front}
        onChange={(e) => setFront(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Перевод / значение"
        value={back}
        onChange={(e) => setBack(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Пример в контексте (необязательно)"
        value={example}
        onChange={(e) => setExample(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !front.trim()}>
          {busy ? 'Добавляю…' : 'Добавить в колоду'}
        </Button>
        {msg && <span className="text-sm text-[var(--night-text-40)]">{msg}</span>}
      </div>
    </Card>
  )
}
