// ============================================================================
// Шторка «Расскажи, как тебе».
//
// Идея взята из FeedbackComponent (ui.watermelon.sh), но не код: там Framer
// Motion и три иконочных набора. Здесь та же механика — палец вверх/вниз
// раскрывает поле, — но на своих иконках и CSS.
//
// Почему оценка НЕ отправляется сразу по нажатию пальца: молчаливый лайк
// говорит нам «хорошо/плохо» и ничего больше. Ценность в одной фразе «что
// именно», поэтому палец только открывает поле, а отправка — осознанная.
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconCheck, IconClose, IconThumbsUp } from './icons'
import { FEEDBACK_MAX, sendFeedback } from '../lib/feedback'
import { describeDbError } from '../lib/dbError'

export function FeedbackSheet({ where, onClose }: { where: string; onClose: () => void }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (state === 'busy') return
    setState('busy')
    setError(null)
    try {
      await sendFeedback({ rating, text, contact, where })
      setState('sent')
      // Закрываем сами: держать шторку после «спасибо» незачем, но и захлопывать
      // мгновенно нельзя — человек должен успеть увидеть, что дошло.
      setTimeout(onClose, 1400)
    } catch (e) {
      setState('idle')
      setError(describeDbError(e, 'отправить отзыв'))
    }
  }

  const thumb = (value: 'up' | 'down') => {
    const active = rating === value
    return (
      <button
        type="button"
        onClick={() => setRating(active ? null : value)}
        aria-pressed={active}
        aria-label={value === 'up' ? 'Нравится' : 'Не нравится'}
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors ${
          active
            ? 'border-[var(--night-accent-45)] bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
            : 'border-white/[0.10] text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
        }`}
      >
        {/* палец вниз — тот же знак, развёрнутый: отдельный SVG заводить незачем */}
        <IconThumbsUp size={22} className={value === 'down' ? 'rotate-180' : ''} />
      </button>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="animate-fade-up flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />

        {state === 'sent' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="animate-answer-pop flex h-14 w-14 items-center justify-center rounded-full bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
              <IconCheck size={28} />
            </span>
            <p className="text-lg font-medium">Спасибо, дошло</p>
            <p className="text-sm text-[var(--night-text-40)]">
              Читаю всё сам. Если оставил контакт — отвечу.
            </p>
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">Как тебе Recall?</h2>
                <p className="mt-0.5 text-sm text-[var(--night-text-40)]">
                  Что мешает или чего не хватает — пиши прямо.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[var(--night-text-40)]"
              >
                <IconClose size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {thumb('up')}
              {thumb('down')}
            </div>

            <label htmlFor="fb-text" className="mt-4 block text-sm text-[var(--night-text-70)]">
              Что улучшить?
            </label>
            <textarea
              id="fb-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, FEEDBACK_MAX))}
              rows={4}
              placeholder="Например: не нашёл, где смотреть свои ошибки"
              className="mt-1.5 w-full resize-none rounded-xl bg-[var(--night-input)] px-3 py-2.5 text-[15px] outline-none focus:ring-1 focus:ring-[var(--night-accent-45)]"
            />
            <p className="mt-1 text-right text-xs text-[var(--night-text-40)]">
              {text.length} / {FEEDBACK_MAX}
            </p>

            <label htmlFor="fb-contact" className="mt-2 block text-sm text-[var(--night-text-70)]">
              Куда ответить <span className="text-[var(--night-text-40)]">— если нужен ответ</span>
            </label>
            <input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="почта или @телеграм"
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl bg-[var(--night-input)] px-3 py-2.5 text-[15px] outline-none focus:ring-1 focus:ring-[var(--night-accent-45)]"
            />

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <Button
              className="mt-4 w-full"
              loading={state === 'busy'}
              disabled={!text.trim() && !rating}
              onClick={send}
            >
              Отправить
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
