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
//                   телефоне — или список, или подробности.
//
// Раскладкам с панелью мало колонки 640 px: они сами просят у каркаса ширину
// страницы (shared/lib/screenWidth) — экран об этом не думает. Одна такая
// раскладка на экран.
//
// Ширины — токены tokens.css (--container-*). Точка «компьютер» — та же, что у
// меню слева (useIsDesktop): раскладка и каркас переключаются вместе.
// ============================================================================
import type { ReactNode } from 'react'
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
}: {
  list: ReactNode
  /** Подробности выбранного; null — ничего не выбрано. */
  detail: ReactNode | null
  /** Что показать справа, пока ничего не выбрано (только компьютер). */
  empty: ReactNode
}) {
  const desktop = useIsDesktop()
  usePageWidth()

  if (!desktop) return <>{detail ?? list}</>
  return (
    <div className="grid grid-cols-[var(--container-list)_minmax(0,1fr)] items-start gap-6">
      <div className="min-w-0">{list}</div>
      <section className="min-w-0">
        {detail ?? (
          <div className="rounded-2xl border border-dashed border-tint/[0.10] p-8 text-center text-sm text-fg-muted">
            {empty}
          </div>
        )}
      </section>
    </div>
  )
}
