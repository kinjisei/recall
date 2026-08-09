// ============================================================================
// Ссылка внутри приложения: тот же <Link>, но с плавным переходом.
//
// Почему нельзя было просто включить переход на все ссылки. Роуты ленивые —
// чанк экрана качается в момент перехода. Снимок «после» браузер делает сразу,
// поэтому без прогрева на нём оказалась бы заглушка «Загрузка…»: анимация
// красиво показала бы спиннер. Здесь чанк сначала греется (и заранее, ещё на
// наведении/касании), и только если он готов — идёт переход. Не успел —
// обычный переход без анимации: лучше без неё, чем с мельканием заглушки.
//
// ⚠️ Внутренние экраны (список → текст, студия → карточка ученика) сюда НЕ
// относятся: они живут в адресных параметрах и анимируются в lib/useUrlState.
// ============================================================================
import { useCallback, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { preloadRoute, warmRoute } from '../lib/routeChunks'
import { withViewTransition, type TransitionDirection } from '../lib/viewTransition'

export interface AppLinkProps {
  to: string
  children: ReactNode
  className?: string
  /** Куда «едет» экран. Вкладки задают направление по своему порядку. */
  direction?: TransitionDirection
  /**
   * Вызывается ДО перехода. Если обработчик сделает preventDefault, перехода
   * не будет (так нижняя навигация обрабатывает повторный тап по своей вкладке).
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  style?: CSSProperties
  role?: string
  'aria-label'?: string
  'aria-current'?: 'page' | undefined
}

export function AppLink({
  to,
  children,
  className,
  direction = 'in',
  onClick,
  ...rest
}: AppLinkProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      // Ctrl/Cmd/средняя кнопка — «открыть в новой вкладке». Перехватывать
      // такое нельзя: человек осознанно просит другое поведение.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return

      e.preventDefault()
      // Тап по адресу, на котором уже стоим, — не переход. Раньше <Link> клал
      // в историю дубль, и «назад» приходилось жать дважды.
      if (to === pathname) return

      void preloadRoute(to).then((ready) => {
        if (ready) withViewTransition(direction, () => navigate(to))
        else navigate(to)
      })
    },
    [onClick, to, pathname, direction, navigate],
  )

  // Греем заранее: к моменту отпускания пальца чанк обычно уже в памяти,
  // и переход играет без задержки.
  const warm = useCallback(() => warmRoute(to), [to])

  return (
    <Link
      to={to}
      className={className}
      onClick={handleClick}
      onPointerEnter={warm}
      onPointerDown={warm}
      {...rest}
    >
      {children}
    </Link>
  )
}
