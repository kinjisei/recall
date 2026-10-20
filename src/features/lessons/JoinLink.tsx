// ============================================================================
// «Войти в урок» (макеты u1, u2): ссылка преподавателя (Meet, Zoom),
// открывается снаружи. Отдельным файлом: её берёт карточка Главной, а
// список «Моих уроков» живёт в ленивом чанке.
// ============================================================================
import { IconVideo } from '../../shared/ui/icons'
import { buttonClass } from '../../shared/ui/Button'

/** «Войти в урок» — ссылка преподавателя (Meet, Zoom), открывается снаружи.
 *  Вид — кнопки (shared/ui/Button): главная за 10 минут до урока, иначе
 *  вторичная. Высота: в строке «Моих уроков» 44, на карточке Главной —
 *  `large`: 48, а главная — 56 (макеты u1, d4-v2). */
export function JoinLink({
  href,
  primary = false,
  large = false,
  className = '',
}: {
  href: string
  primary?: boolean
  large?: boolean
  className?: string
}) {
  const size = large ? (primary ? 'lg' : 'md') : primary ? 'md' : 'sm'
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${buttonClass(primary ? 'primary' : 'secondary', size)} ${className}`}
    >
      <IconVideo size={18} aria-hidden />
      Войти в урок
    </a>
  )
}
