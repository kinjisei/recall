// ============================================================================
// Карточка «Диалог» на «Моей учёбе» (макет d12, справа): последние реплики
// разговора с AI на языке учёбы и поле ответа. Разговор уже был (d12-1) —
// три последние реплики, поправка AI отдельной строкой над его ответом и «Весь
// разговор →»; не было (d12-2) — «Напиши что-нибудь…» и пример в поле.
// Поле пишет в тот же черновик, что и «Диалог» (`chat:<язык>`), а «Отправить»
// уводит в «Диалог», где реплика уходит обычной отправкой и приходит ответ
// (журнал п.76 (9)): мини-чата с копией логики AI здесь нет.
// ============================================================================
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { loadLastChat } from '../../lib/chatHistory'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useDraft } from '../../shared/lib/useDraft'
import { AppLink } from '../../shared/ui/AppLink'
import { ChatBubble } from '../../shared/ui/Chat'
import { IconArrowRight, IconDialog, IconSparkle } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import type { AppLang } from '../../types'
import { MARKER_LOOK, SEND_DRAFT_STATE, splitReply } from '../conversation'

const IN: Record<AppLang, string> = { en: 'по-английски', es: 'по-испански' }
const EXAMPLE: Record<AppLang, string> = { en: 'Например: Hi! How are you?', es: 'Например: Hola, ¿cómo estás?' }

export function LearnDialog({ lang }: { lang: AppLang }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const chat = useAsyncData(() => (user ? loadLastChat(user.id, lang) : Promise.resolve(null)), [user?.id, lang], 'Разговор не загрузился — похоже, пропала связь')
  const [input, setInput] = useDraft(`chat:${lang}`, '')
  const turns = (chat.data?.turns ?? []).slice(-3)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    navigate('/conversation', input.trim() ? { state: SEND_DRAFT_STATE } : undefined)
  }

  return (
    <section aria-label="Диалог" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card" data-learn-dialog>
      <div className="flex items-center gap-2.5">
        <span className="flex size-9.5 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <IconDialog size={20} aria-hidden />
        </span>
        <span className="flex flex-col leading-snug">
          <b className="text-base font-semibold text-fg">Диалог</b>
          <small className="text-note text-fg-secondary">разговор с AI {IN[lang]}</small>
        </span>
      </div>

      {chat.error ? (
        <LoadError message={chat.error} onRetry={chat.reload} />
      ) : chat.loading ? (
        <RowsSkeleton count={3} height={44} />
      ) : turns.length === 0 ? (
        <p className="flex gap-2 rounded-control-sm bg-accent-soft px-3.5 py-3 text-sm text-accent-soft-fg">
          <IconSparkle size={16} aria-hidden className="mt-0.5 flex-none" />
          Напиши что-нибудь {IN[lang]} — AI ответит и поправит ошибки
        </p>
      ) : (
        <div className="flex flex-col gap-2" lang={lang}>
          {turns.map((t, i) => {
            if (t.role === 'user') {
              return (
                <ChatBubble key={i} mine inCard>
                  <span className="line-clamp-4">{t.content}</span>
                </ChatBubble>
              )
            }
            const { notes, text } = splitReply(t.content)
            return (
              <div key={i} className="contents">
                {/* поправка — одна, первая: карточка — превью, весь разбор — в «Диалоге» */}
                {notes.slice(0, 1).map((n, j) => {
                  const { Icon, cls } = MARKER_LOOK[n.kind]
                  return (
                    <p key={j} lang="ru" className="flex max-w-[88%] gap-2 self-start rounded-xl px-2.5 py-2 text-note text-fg-secondary inset-ring inset-ring-line">
                      <Icon size={16} aria-hidden className={`mt-px flex-none ${cls}`} />
                      <span className="line-clamp-3">{n.text}</span>
                    </p>
                  )
                })}
                {text && (
                  <ChatBubble mine={false} inCard>
                    <span className="line-clamp-4">{text}</span>
                  </ChatBubble>
                )}
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 rounded-control bg-input py-1.5 pl-3.5 pr-1.5 focus-within:inset-ring-2 focus-within:inset-ring-focus">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          rows={1}
          lang={lang}
          aria-label={`Ответ ${IN[lang]}`}
          placeholder={turns.length ? `Ответь ${IN[lang]}…` : EXAMPLE[lang]}
          className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body text-fg outline-none placeholder:text-fg-muted"
        />
        <button type="submit" aria-label="Отправить в «Диалог»" className="flex size-11 flex-none items-center justify-center rounded-xl bg-surface text-fg-muted active:bg-row-press">
          <IconArrowRight size={20} aria-hidden />
        </button>
      </form>

      {turns.length > 0 && (
        <AppLink to="/conversation" className="flex min-h-11 items-center self-start text-sm font-medium text-accent-strong">
          Весь разговор →
        </AppLink>
      )}
    </section>
  )
}
