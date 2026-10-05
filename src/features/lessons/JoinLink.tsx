// ============================================================================
// «Войти в урок» (макеты u1, u2): ссылка преподавателя (Meet, Zoom),
// открывается снаружи. Отдельным файлом: её берёт карточка Главной, а
// список «Моих уроков» живёт в ленивом чанке.
// ============================================================================
import { IconVideo } from '../../shared/ui/icons'

/** «Войти в урок» — ссылка преподавателя (Meet, Zoom), открывается снаружи. */
export function JoinLink({ href, primary = false, className = '' }: { href: string; primary?: boolean; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[transform,filter] duration-150 active:scale-98 ${
        primary ? 'bg-primary text-primary-fg shadow-card hover:brightness-95' : 'bg-accent-soft text-accent-soft-fg hover:brightness-95'
      } ${className}`}
    >
      <IconVideo size={18} aria-hidden />
      Войти в урок
    </a>
  )
}
