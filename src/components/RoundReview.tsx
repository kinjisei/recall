// ============================================================================
// Разбор результатов раунда практики: список вопросов раунда — что ввёл ученик,
// верный ответ, ✓/✗. У неверных — кнопка «Почему?» (дешёвый AI по запросу,
// lib/explain). Общий для всех режимов; открывается из RoundResult.
// ============================================================================
import { useState } from 'react'
import { Sheet } from '../shared/ui/Sheet'
import { IconCheck, IconClose } from '../shared/ui/icons'
import { explainMistake } from '../lib/explain'
import type { AppLang } from '../types'
import { Thinking } from '../shared/ui/Thinking'

export interface ReviewItem {
  /** Текст вопроса/задания. */
  prompt: string
  /** Что ответил ученик. */
  given: string
  /** Верный ответ. */
  correct: string
  ok: boolean
}

export function RoundReview({
  items,
  lang,
  onClose,
}: {
  items: ReviewItem[]
  lang: AppLang
  onClose: () => void
}) {
  const [why, setWhy] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  const explain = async (i: number, it: ReviewItem) => {
    if (why[i] || loading[i]) return
    setLoading((l) => ({ ...l, [i]: true }))
    try {
      const t = await explainMistake(it.prompt, it.given, it.correct, lang)
      setWhy((w) => ({ ...w, [i]: t }))
    } catch (e) {
      // причину не глотаем: сервер объясняет, что именно случилось («энергия
      // на сегодня кончилась», «нет связи») — иначе человек жмёт «Почему?»
      // вслепую и получает одно и то же (находка ревью 2В)
      setWhy((w) => ({
        ...w,
        [i]: e instanceof Error ? e.message : 'Не удалось объяснить. Попробуй ещё раз.',
      }))
    } finally {
      setLoading((l) => ({ ...l, [i]: false }))
    }
  }

  return (
    <Sheet onClose={onClose} maxH="85dvh" label="Итоги раунда">
        <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <p className="text-[10px] uppercase tracking-wider text-fg-muted">Результаты</p>
          <div className="mt-2 flex flex-col gap-2">
            {items.map((it, i) => (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2 ${it.ok ? 'border-success/30' : 'border-danger/30'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-none ${it.ok ? 'text-success-strong' : 'text-danger-strong'}`}>
                    {it.ok ? <IconCheck size={16} /> : <IconClose size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {it.prompt && <p className="text-sm font-medium">{it.prompt}</p>}
                    {!it.ok && (
                      <p className="text-sm text-fg-muted">
                        Твой ответ: <span className="text-danger-soft-fg">{it.given}</span>
                      </p>
                    )}
                    <p className="text-sm text-fg-muted">
                      {it.ok ? 'Верно: ' : 'Правильно: '}
                      <span className="text-success-soft-fg">{it.correct}</span>
                    </p>
                    {!it.ok &&
                      (why[i] ? (
                        <p className="mt-1 rounded-lg bg-tint/[0.04] px-2.5 py-1.5 text-sm leading-relaxed text-fg-secondary">
                          {why[i]}
                        </p>
                      ) : loading[i] ? (
                        <Thinking label="Думаю" className="mt-1 text-sm" />
                      ) : (
                        <button
                          onClick={() => explain(i, it)}
                          className="mt-1 text-sm font-semibold text-accent-strong"
                        >
                          Почему?
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </Sheet>
  )
}
