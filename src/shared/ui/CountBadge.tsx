// ============================================================================
// Счётчик-кружок: непрочитанные у колокольчика, «ждут проверки» на вкладке
// «Задания» (макет t1). Один вид на всё приложение — иначе у колокольчика и
// у вкладки рядом были бы два разных кружка. Ноль — ничего не рисует.
// Стоит поверх своего элемента (родителю нужен relative) или в строке — inline.
// ============================================================================

export function CountBadge({ n, inline = false, className = '' }: { n: number; inline?: boolean; className?: string }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden
      className={`${inline ? '' : 'absolute'} flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-caption font-semibold text-accent-fg ${className}`}
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}
