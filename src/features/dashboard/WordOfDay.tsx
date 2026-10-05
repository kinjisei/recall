// ============================================================================
// «Слово дня» на Главной: новое слово уровня, окно со словом, «В колоду».
// Вынесено из DashboardPage.tsx без правок поведения (PLAN.md Ф2.9 — Главная
// не растёт).
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconArrowRight, IconCheck, IconClose, IconHint, IconPlus, IconSpeaker } from '../../shared/ui/icons'
import { Button } from '../../shared/ui/Button'
import { addCard } from '../../lib/cards'
import { speak } from '../../lib/speech'
import type { PoolItem } from '../../lib/wordPool'

export function WordOfDay({ word, lang }: { word: PoolItem; lang: 'en' | 'es' }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'error'>('idle')

  const add = async () => {
    if (state === 'busy' || state === 'added') return
    setState('busy')
    try {
      await addCard({
        front: word.term,
        back: word.translation,
        example: word.example,
        lang,
        source: 'manual',
      })
      setState('added')
    } catch {
      setState('error')
    }
  }

  return (
    <>
      {/* Вся строка — кнопка: тап открывает окно со словом (стрелка-подсказка) */}
      <button
        onClick={() => setOpen(true)}
        className="lift animate-fade-up flex w-full items-center gap-3.5 rounded-2xl border border-tint/[0.08] bg-surface px-4 py-3.5 text-left shadow-card"
        style={{ animationDelay: '.45s' }}
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
          <IconHint size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-micro uppercase tracking-wider text-fg-muted">
            Слово дня
          </p>
          <p className="truncate text-body font-medium">
            {word.term}
            <span className="text-fg-muted"> — {word.translation}</span>
          </p>
        </div>
        <IconArrowRight size={18} className="flex-none text-fg-muted" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/60 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="animate-fade-up w-full rounded-t-3xl border border-tint/[0.08] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-3xl sm:pb-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <p className="text-micro uppercase tracking-wider text-fg-muted">
                  Слово дня
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="lift -mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-fg-muted"
                >
                  <IconClose size={20} />
                </button>
              </div>
              <p className="mt-1 text-2xl font-semibold">{word.term}</p>
              <p className="text-fg-secondary">{word.translation}</p>
              {word.example && (
                <p className="mt-3 rounded-xl bg-tint/[0.04] px-3 py-2 text-sm italic leading-relaxed text-fg-secondary">
                  {word.example}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => speak(word.term, { lang })}
                >
                  <IconSpeaker size={18} /> Послушать
                </Button>
                <Button
                  className="flex-1"
                  onClick={add}
                  loading={state === 'busy'}
                  disabled={state === 'added'}
                >
                  {state === 'added' ? (
                    <>
                      <IconCheck size={18} /> В колоде
                    </>
                  ) : (
                    <>
                      <IconPlus size={18} /> В колоду
                    </>
                  )}
                </Button>
              </div>
              {state === 'error' && (
                <p className="mt-2 text-xs text-danger-strong">Не удалось добавить — попробуй ещё раз</p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
