// ============================================================================
// Вид переписки — один на оба чата («Диалог» и AI-квесты).
//
// Раньше лента обрывалась прямыми срезами: сверху сообщение резалось посреди
// пузыря, снизу упиралось в полосу панели ввода во всю ширину экрана, а поле
// и кнопка отправки были квадратными плитками (замечание владельца
// 30.09.2026). Теперь:
//   • ChatWindow — скруглённое «окно» ленты с отступами; у верхнего и нижнего
//     края текст мягко гаснет (маска), а не режется линией;
//   • ChatInputBar — плавающая капсула ввода с отступами от краёв экрана:
//     поле-«таблетка» и круглая кнопка отправки;
//   • ChatBubble — пузырь реплики (свой — акцентом, ответ — поверхностью).
// Где стоит панель и какой высоты лента, считает lib/useChatList: ленте нужна
// настоящая высота панели — поэтому панель отдаёт ему barRef.
// ============================================================================
import { forwardRef, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { IconSend } from './icons'
import { DraftRestored } from './DraftRestored'
import type { DraftControls } from '../lib/useDraft'

/** Скруглённое окно ленты: сам список скроллится внутри (ref — на него). */
export const ChatWindow = forwardRef<HTMLDivElement, { height: number | null; children: ReactNode }>(
  function ChatWindow({ height, children }, ref) {
    return (
      <div className="overflow-hidden rounded-3xl border border-tint/[0.06] bg-tint/[0.02]">
        <div
          ref={ref}
          style={height ? { height } : undefined}
          // текст у верхнего и нижнего края гаснет, а не режется прямой линией
          className="flex flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-4 [mask-image:linear-gradient(to_bottom,transparent,black_1rem,black_calc(100%-1rem),transparent)]"
        >
          {children}
        </div>
      </div>
    )
  },
)

/** Пузырь реплики: свой — справа, акцентом; ответ — слева, поверхностью. */
export function ChatBubble({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div
      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-body leading-relaxed text-fg ${
        mine
          ? 'self-end rounded-br-md border border-accent-line bg-accent/18'
          : 'self-start rounded-bl-md border border-tint/[0.08] bg-surface shadow-card'
      }`}
    >
      {children}
    </div>
  )
}

/**
 * Плавающая капсула ввода. Закреплена у окна (над клавиатурой или над
 * навигацией каркаса — style из useChatList), с отступами от краёв экрана.
 * `after` — строка под капсулой («Новый диалог»).
 */
export const ChatInputBar = forwardRef<
  HTMLDivElement,
  {
    style: CSSProperties
    value: string
    onChange: (v: string) => void
    onSubmit: (e: FormEvent) => void
    busy: boolean
    placeholder: string
    label: string
    after?: ReactNode
    /** Черновик поля (useDraft): вернулся после перезагрузки — строка «Черновик восстановлен». */
    draft?: DraftControls
  }
>(function ChatInputBar({ style, value, onChange, onSubmit, busy, placeholder, label, after, draft }, ref) {
  return (
    <div ref={ref} className="fixed inset-x-0 z-30 mx-auto max-w-screen-sm px-4 pb-2 pt-2" style={style}>
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 rounded-full border border-tint/[0.08] bg-surface p-1.5 shadow-raised"
      >
        <input
          aria-label={label}
          className="h-11 min-w-0 flex-1 rounded-full bg-input px-4 text-body outline-none placeholder:text-fg-muted focus:ring-2 focus:ring-accent-line"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          aria-label="Отправить"
          disabled={busy || !value.trim()}
          className="lift flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-accent-fg transition-[filter] hover:brightness-105 disabled:opacity-40"
        >
          <IconSend size={18} />
        </button>
      </form>
      {draft?.restored && <DraftRestored onClear={draft.clear} className="mt-1.5 justify-center" />}
      {after}
    </div>
  )
})
