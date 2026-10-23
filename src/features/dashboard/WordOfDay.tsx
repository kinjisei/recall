// ============================================================================
// «Слово дня» на Главной (макеты u1-1, d4-v2): метка, слово 26, перевод и
// «Послушать» сразу на карточке. Тап по слову — шторка с примером и
// «В колоду» (новое слово уровня можно сразу добавить в повторение).
// ============================================================================
import { useState } from 'react'
import { IconCheck, IconPlus, IconSpeaker } from '../../shared/ui/icons'
import { Button } from '../../shared/ui/Button'
import { SHEET_BODY, Sheet } from '../../shared/ui/Sheet'
import { SheetHeader } from '../../shared/ui/SheetHeader'
import { addCard } from '../../lib/cards'
import { speak } from '../../lib/speech'
import type { PoolItem } from '../../lib/wordPool'
import { ErrorText } from '../../shared/ui/ErrorText'

export function WordOfDay({ word, lang, compact = false }: { word: PoolItem; lang: 'en' | 'es'; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'error'>('idle')
  const listen = () => speak(word.term, { lang })

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
      <section
        aria-label="Слово дня"
        className={`animate-fade-up flex justify-between gap-3 rounded-card bg-surface p-4.5 shadow-card ${compact ? 'items-center' : 'items-end'}`}
        style={{ animationDelay: '.3s' }}
      >
        {/* слово — кнопка: шторка с примером и «В колоду» */}
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-col items-start gap-1.5 text-left">
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-soft-fg">Слово дня</span>
          <span className="flex min-w-0 flex-col">
            <span lang={lang} className="truncate text-2xl font-semibold leading-tight tracking-normal">
              {word.term}
            </span>
            <span className="text-body text-fg-secondary">{word.translation}</span>
          </span>
        </button>
        <Button variant="secondary" size="sm" onClick={listen} className="flex-none px-3.5! text-body! font-semibold!">
          <IconSpeaker size={18} aria-hidden /> Послушать
        </Button>
      </section>

      {open && (
        <Sheet onClose={() => setOpen(false)} labelledBy="word-of-day">
          <SheetHeader id="word-of-day" title="Слово дня" />
          <div className={SHEET_BODY}>
            <div>
              <p lang={lang} className="text-2xl font-semibold">
                {word.term}
              </p>
              <p className="text-body text-fg-secondary">{word.translation}</p>
            </div>
            {word.example && (
              <p lang={lang} className="rounded-control bg-input px-3 py-2 text-sm italic leading-relaxed text-fg-secondary">
                {word.example}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={listen}>
                <IconSpeaker size={18} aria-hidden /> Послушать
              </Button>
              <Button className="flex-1" onClick={add} loading={state === 'busy'} disabled={state === 'added'}>
                {state === 'added' ? (
                  <>
                    <IconCheck size={18} aria-hidden /> В колоде
                  </>
                ) : (
                  <>
                    <IconPlus size={18} aria-hidden /> В колоду
                  </>
                )}
              </Button>
            </div>
            {state === 'error' && <ErrorText>Не удалось добавить — попробуй ещё раз</ErrorText>}
          </div>
        </Sheet>
      )}
    </>
  )
}
