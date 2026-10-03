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
import { Sheet } from '../shared/ui/Sheet'
import { Button } from '../shared/ui/Button'
import { IconCheck, IconClose, IconThumbsUp } from '../shared/ui/icons'
import { FEEDBACK_MAX, sendFeedback } from '../lib/feedback'
import { describeDbError } from '../shared/api/errors'
import { useDraft } from '../shared/lib/useDraft'
import { DraftRestored } from '../shared/ui/DraftRestored'

export function FeedbackSheet({ where, onClose }: { where: string; onClose: () => void }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  // текст переживает перезагрузку, пока отзыв не отправлен (Ф1.14)
  const [text, setText, draft] = useDraft(`feedback:${where}`, '')
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
      draft.forget()
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
            ? 'border-accent-line bg-accent-soft text-accent-soft-fg'
            : 'border-tint/[0.10] text-fg-muted hover:text-fg-secondary'
        }`}
      >
        {/* палец вниз — тот же знак, развёрнутый: отдельный SVG заводить незачем */}
        <IconThumbsUp size={22} className={value === 'down' ? 'rotate-180' : ''} />
      </button>
    )
  }

  return (
    <Sheet onClose={onClose} maxH="85dvh" label="Обратная связь">

        {state === 'sent' ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="animate-answer-pop flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <IconCheck size={28} />
            </span>
            <p className="text-lg font-medium">Спасибо, дошло</p>
            <p className="text-sm text-fg-muted">
              Читаю всё сам. Если оставил контакт — отвечу.
            </p>
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">Как тебе Recall?</h2>
                <p className="mt-0.5 text-sm text-fg-muted">
                  Что мешает или чего не хватает — пиши прямо.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-fg-muted"
              >
                <IconClose size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {thumb('up')}
              {thumb('down')}
            </div>

            <label htmlFor="fb-text" className="mt-4 block text-sm text-fg-secondary">
              Что улучшить?
            </label>
            <textarea
              id="fb-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, FEEDBACK_MAX))}
              rows={4}
              placeholder="Например: не нашёл, где смотреть свои ошибки"
              className="mt-1.5 w-full resize-none rounded-xl bg-input px-3 py-2.5 text-[15px] outline-none ring-1 ring-control-line focus:ring-1 focus:ring-accent-line"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              {draft.restored ? <DraftRestored onClear={draft.clear} /> : <span />}
              <p className="text-xs text-fg-muted">
                {text.length} / {FEEDBACK_MAX}
              </p>
            </div>

            <label htmlFor="fb-contact" className="mt-2 block text-sm text-fg-secondary">
              Куда ответить <span className="text-fg-muted">— если нужен ответ</span>
            </label>
            <input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="почта или @телеграм"
              autoComplete="off"
              className="mt-1.5 w-full rounded-xl bg-input px-3 py-2.5 text-[15px] outline-none ring-1 ring-control-line focus:ring-1 focus:ring-accent-line"
            />

            {error && <p className="mt-3 text-sm text-danger-strong">{error}</p>}

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
    </Sheet>
  )
}
