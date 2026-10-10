// ============================================================================
// Общие раскладки экранов (журнал п.46; архитектура §5). Раздел не придумывает
// свою раскладку, а берёт одну из этих:
//
//   CenterColumn  — упражнение, игра: узкая колонка по центру (576 px), чтобы
//                   глазу не бегать по широкому экрану;
//   ReadingColumn — чтение: строка удобной длины (~70 знаков, 672 px), рядом на
//                   компьютере — панель (перевод слова), место под неё держим
//                   всегда; на телефоне панель открывается шторкой снизу;
//   ListDetail    — список слева, подробности справа (ученики, материалы); на
//                   телефоне — или список, или подробности; с `fill` на
//                   компьютере занимает окно до низа, и список с подробностями
//                   прокручиваются каждый сам, а страница — нет (макет d3).
//
// Раскладкам с панелью мало колонки 640 px: они сами просят у каркаса ширину
// страницы (shared/lib/screenWidth) — экран об этом не думает. Одна такая
// раскладка на экран.
//
// Ширины — токены tokens.css (--container-*). Точка «компьютер» — та же, что у
// меню слева (useIsDesktop): раскладка и каркас переключаются вместе.
// ============================================================================
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { usePageWidth } from '../lib/screenWidth'
import { useIsDesktop } from '../lib/useMediaQuery'
import { Sheet } from './Sheet'

/** Колонка по центру: упражнения, игры. */
export function CenterColumn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-exercise ${className}`}>{children}</div>
}

/**
 * Колонка чтения с панелью: на компьютере панель стоит справа и не
 * перекрывает текст (читаешь дальше, перевод рядом); на телефоне — шторка.
 */
export function ReadingColumn({
  children,
  aside,
  onAsideClose,
  asideLabel,
  asideHint,
}: {
  children: ReactNode
  /** Содержимое панели (например, перевод слова); null — панель пуста. */
  aside: ReactNode | null
  /** Закрыть панель: на телефоне это шторка. */
  onAsideClose: () => void
  /** Подпись панели для скринридера. */
  asideLabel: string
  /** Что показать в пустой панели на компьютере — место под неё есть всегда,
   *  иначе текст прыгал бы при первом тапе по слову. */
  asideHint?: ReactNode
}) {
  const desktop = useIsDesktop()
  usePageWidth()

  if (!desktop) {
    return (
      <div className="mx-auto w-full max-w-reading">
        {children}
        {aside && (
          <Sheet onClose={onAsideClose} label={asideLabel}>
            <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-1">{aside}</div>
          </Sheet>
        )}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[minmax(0,var(--container-reading))_var(--container-aside)] justify-center gap-8">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label={asideLabel}
        className="sticky top-8 max-h-[calc(100dvh-4rem)] self-start overflow-y-auto rounded-2xl border border-tint/[0.08] bg-surface p-5 shadow-card"
      >
        {aside ?? <p className="text-sm text-fg-muted">{asideHint}</p>}
      </aside>
    </div>
  )
}

/**
 * Список + подробности: на компьютере рядом, на телефоне — одно из двух
 * (выбранный пункт открывает подробности на весь экран, «назад» — к списку;
 * что выбрано, экран держит в адресе, useUrlState).
 */
export function ListDetail({
  list,
  detail,
  empty,
  fill = false,
}: {
  list: ReactNode
  /** Подробности выбранного; null — ничего не выбрано. */
  detail: ReactNode | null
  /** Что показать справа, пока ничего не выбрано (только компьютер). */
  empty: ReactNode
  /**
   * Компьютер: до низа окна, у списка и подробностей своя прокрутка. Длинная
   * карточка иначе уносила вверх и список (приёмка Ф2.11, макет d3).
   */
  fill?: boolean
}) {
  const desktop = useIsDesktop()
  usePageWidth()
  const fillRef = useRef<HTMLDivElement>(null)
  const height = useFillHeight(fillRef, desktop && fill)

  if (!desktop) return <>{detail ?? list}</>
  const pane = fill ? 'h-full min-h-0 overflow-y-auto overscroll-contain px-1 pb-4 -mx-1' : ''
  return (
    <div
      ref={fillRef}
      data-list-detail={fill ? 'fill' : undefined}
      style={fill ? { height } : undefined}
      className={`grid grid-cols-[var(--container-list)_minmax(0,1fr)] gap-6 ${fill ? '' : 'items-start'}`}
    >
      <div className={`min-w-0 ${pane}`} data-pane="list">
        {list}
      </div>
      {/* data-pane — экран находит свою панель прокрутки (новый раздел карточки — наверх) */}
      <section className={`min-w-0 ${pane}`} data-pane="detail">
        {detail ?? (
          <div className="rounded-2xl border border-dashed border-tint/[0.10] p-8 text-center text-sm text-fg-muted">
            {empty}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * Высота «от этого места до низа окна» минус нижний отступ рамки (pb-10 у
 * <main> на компьютере). Место сдвигается, когда над ним раскрывается
 * пояснение или появляется плашка тарифа, — следим за размером <main>.
 */
function useFillHeight(ref: React.RefObject<HTMLElement | null>, on: boolean): string | undefined {
  const [top, setTop] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!on || !el) return
    const measure = () => setTop(el.getBoundingClientRect().top + window.scrollY)
    measure()
    const ro = new ResizeObserver(measure)
    const main = el.closest('main')
    if (main) ro.observe(main)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, on])
  return on && top !== null ? `calc(100dvh - ${Math.round(top)}px - 2.5rem)` : undefined
}
