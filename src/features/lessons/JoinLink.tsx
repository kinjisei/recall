// ============================================================================
// «Войти в урок» (макеты u1, u2): ссылка преподавателя (Meet, Zoom),
// открывается снаружи. Отдельным файлом: её берёт карточка Главной, а
// список «Моих уроков» живёт в ленивом чанке.
// ============================================================================
import { IconVideo } from '../../shared/ui/icons'
import { buttonClass } from '../../shared/ui/Button'

/** «Войти в урок» — ссылка преподавателя (Meet, Zoom), открывается снаружи.
 *  Вид — кнопки (shared/ui/Button): главная за 10 минут до урока, иначе
 *  вторичная; urgent — во всю ширину и высотой 48. */
export function JoinLink({ href, primary = false, className = '' }: { href: string; primary?: boolean; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${buttonClass(primary ? 'primary' : 'secondary', primary ? 'md' : 'sm')} ${className}`}
    >
      <IconVideo size={18} aria-hidden />
      Войти в урок
    </a>
  )
}
