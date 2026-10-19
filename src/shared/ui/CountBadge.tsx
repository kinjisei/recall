// ============================================================================
// Счётчик (листы s3, s4): только число того, что ждёт действия —
// непрочитанные у колокольчика, «ждут проверки» на вкладке «Задания»
// (макет t1). До 99, дальше «99+». Цвет главной кнопки, вокруг — кольцо
// цвета страницы 2 px, чтобы кружок отделялся от иконки под ним. Один вид на
// всё приложение. Ноль — ничего не рисует.
// Стоит поверх своего элемента (родителю нужен relative) или в строке — inline
// (меню компьютера: 20 × 20, s4-2).
// ============================================================================

/** Подпись счётчика: 1…99, дальше «99+». */
export function countLabel(n: number): string {
  return n > 99 ? '99+' : String(n)
}

export function CountBadge({ n, inline = false, className = '' }: { n: number; inline?: boolean; className?: string }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full bg-primary font-bold tabular-nums text-primary-fg ${
        inline ? 'h-5 min-w-5 px-1.5 text-xs' : 'absolute h-4.5 min-w-4.5 px-1.25 text-caption ring-2 ring-page'
      } ${className}`}
    >
      {countLabel(n)}
    </span>
  )
}
