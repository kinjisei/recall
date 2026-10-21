// ============================================================================
// Общие раскладки экранов (журнал п.46, п.55; правила d0; архитектура §5).
// Раздел не придумывает свою раскладку, а берёт одну из этих:
//
//   CenterColumn  — упражнение, игра: узкая колонка по центру (600 px), чтобы
//                   глазу не бегать по широкому экрану; от 1120 — тихие поля
//                   по бокам: прогресс раунда и клавиши;
//   ReadingColumn — чтение: строка удобной длины (680 px ≈ 60 знаков), рядом —
//                   панель 320 (перевод слова), место под неё держим всегда;
//                   содержимое уже 912 — панель открывается шторкой;
//   ListDetail    — список 352 слева, подробности справа (ученики, материалы);
//                   содержимое уже 880 — или список, или подробности; с `fill`
//                   занимает окно до низа, и список с подробностями
//                   прокручиваются каждый сам, а страница — нет (макет d3);
//   MainAside     — главная колонка 720 + правая 352 («Моя учёба», хаб
//                   «Заданий»; `size="narrow"` — 320, итог проверки d7-2;
//                   `size="work"` — работа до 680 и итог от 312, мастер
//                   материала d8: 640 + 312 на 1280, 680 + 416 на 1440): справа
//                   то, что сверяют, а не делают; содержимое уже 936 — одна
//                   колонка, правая уходит под главную;
//   TextPanel     — текст ученика до 640 + панель проверки от 412 (d7-3,
//                   d7-4): текст держится в окне; уже 936 — одна колонка;
//   EvenColumns   — две равные колонки (Главная ученика, макет d4-v2): ряд
//                   пары одной высоты, под ним две стопки; уже 936 — одна
//                   колонка в порядке телефона.
//
// Вид выбирается по ширине СОДЕРЖИМОГО, а не окна (d0, правило 6): каркас
// меряет его и отдаёт через shared/lib/screenWidth — одинаково при меню 240,
// рельсе 72 и окне в пол-экрана. Пороги — AREA (shared/ui/breakpoints).
// Раскладкам мало колонки 640 px: они сами просят у каркаса ширину страницы и
// говорят, сколько им нужно (по этому числу правая панель решает, сдвинуть
// содержимое или лечь поверх) — экран об этом не думает. Одна такая раскладка
// на экран.
// ============================================================================
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useContentAtLeast, usePageWidth } from '../lib/screenWidth'
import { AREA } from './breakpoints'
import { Sheet } from './Sheet'

/**
 * Колонка по центру: упражнения, игры. Поля по бокам не пустые, но тихие
 * (макет d0-3): слева — прогресс раунда, справа — подсказка клавиш; только
 * когда содержимому хватает места (от 1120), уже — экран показывает прогресс
 * сверху, как на телефоне.
 */
export function CenterColumn({
  children,
  className = '',
  left,
  right,
}: {
  children: ReactNode
  className?: string
  /** Тихое поле слева (прогресс раунда) — только на широком содержимом. */
  left?: ReactNode
  /** Тихое поле справа (подсказка клавиш) — только на широком содержимом. */
  right?: ReactNode
}) {
  const asks = !!(left || right)
  const wide = useContentAtLeast(AREA.exerciseSides)
  const sides = asks && wide
  // без боковых полей колонке ширина страницы не нужна — и чужую не сбрасываем
  usePageWidth(asks ? (sides ? 'page' : null) : undefined, AREA.exerciseSides)
  const column = <div className={`mx-auto w-full max-w-exercise ${className}`}>{children}</div>
  if (!sides) return column
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_var(--container-exercise)_minmax(0,1fr)] items-start gap-6">
      <aside className="sticky top-8 text-sm text-fg-muted">{left}</aside>
      {column}
      <aside className="sticky top-8 text-sm text-fg-muted">{right}</aside>
    </div>
  )
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
  const split = useContentAtLeast(AREA.readingSplit)
  usePageWidth('page', AREA.readingSplit)

  if (!split) {
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
 * Рядом ли список и подробности (содержимое от 880 px). Экрану, который
 * держит выбранный пункт, нужен тот же ответ — например, «назад» к списку
 * только когда они не рядом.
 */
export function useListDetailSplit(): boolean {
  return useContentAtLeast(AREA.split)
}

/**
 * Список + подробности: рядом, когда хватает места, иначе — одно из двух
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
  const split = useListDetailSplit()
  // по очереди — колонкой, как на телефоне: список на 800 px шириной ни к чему
  usePageWidth(split ? 'page' : null, AREA.split)
  const fillRef = useRef<HTMLDivElement>(null)
  const height = useFillHeight(fillRef, split && fill)

  if (!split) return <>{detail ?? list}</>
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
 * Главная колонка + правая (макет d0-3): главная до 720, правая 352 —
 * липкая при прокрутке. Содержимое уже 936 — одна колонка: сначала главная,
 * под ней правая. Одно главное действие экрана — в главной колонке (d0,
 * правило 10), правая его не дублирует.
 */
export function MainAside({
  main,
  aside,
  size = 'list',
  label,
}: {
  main: ReactNode
  aside: ReactNode
  /**
   * Ширины: `list` — главная до 720 и правая 352; `narrow` — правая 320
   * (итог проверки рядом с работой, d7-2); `work` — работа до 680 и итог не
   * уже 312, остаток — итогу (мастер материала, d8-2…d8-4).
   */
  size?: 'list' | 'narrow' | 'work'
  /** Подпись правой колонки для читалки. */
  label?: string
}) {
  const split = useContentAtLeast(AREA.homeSplit)
  usePageWidth('page', AREA.homeSplit)
  if (!split) {
    return (
      <div className="mx-auto flex w-full max-w-main flex-col gap-4">
        {main}
        {aside}
      </div>
    )
  }
  const cols =
    size === 'work'
      ? 'grid-cols-[minmax(0,var(--container-reading))_minmax(var(--container-summary),1fr)]'
      : size === 'narrow'
        ? 'grid-cols-[minmax(0,var(--container-main))_var(--container-aside)] justify-center'
        : 'grid-cols-[minmax(0,var(--container-main))_var(--container-list)] justify-center'
  return (
    <div className={`grid ${cols} gap-6`}>
      <div className="min-w-0">{main}</div>
      <aside aria-label={label} className="sticky top-8 flex flex-col gap-3.5 self-start">
        {aside}
      </aside>
    </div>
  )
}

/** Две колонки ли у MainAside и TextPanel (содержимое от 936 px): экрану — тот же ответ, что раскладке. */
export function useAsideSplit(): boolean {
  return useContentAtLeast(AREA.homeSplit)
}

/**
 * Текст + рабочая панель (проверка письма, макеты d7-3 и d7-4): слева текст
 * ученика колонкой до 640 — он держится в окне и прокручивается сам, пока
 * справа листаешь правки; справа — разбор и решение учителя, не уже 412
 * (на 1280 текст сжимается до 540). Уже 936 — одна колонка: текст, под ним
 * панель.
 */
export function TextPanel({ text, panel, label }: { text: ReactNode; panel: ReactNode; label?: string }) {
  const split = useAsideSplit()
  usePageWidth('page', AREA.homeSplit)
  if (!split) {
    return (
      <div className="mx-auto flex w-full max-w-main flex-col gap-3.5">
        {text}
        {panel}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[minmax(0,var(--container-essay))_minmax(var(--container-panel),1fr)] gap-6">
      <div data-text-pane className="sticky top-8 max-h-[calc(100dvh-4rem)] min-w-0 self-start overflow-y-auto overscroll-contain rounded-card">
        {text}
      </div>
      <section aria-label={label} className="flex min-w-0 flex-col gap-3.5">
        {panel}
      </section>
    </div>
  )
}

/** Две ли колонки (содержимое от 936 px): экрану — тот же ответ, что раскладке. */
export function useEvenColumnsSplit(): boolean {
  return useContentAtLeast(AREA.homeSplit)
}

/**
 * Две равные колонки (макет d4-v2: «6 + 6 из 12», 478 на 1280, 550 на 1440).
 * Первый ряд — пара одной высоты (`pair`), под ним — левая и правая стопки,
 * каждая своей высоты: подгонять по высоте нужно только первый ряд. Содержимое
 * уже 936 — одна колонка (`stack`) в порядке экрана телефона (u1): порядок у
 * колонки свой, не «левая, потом правая», поэтому экран отдаёт его отдельно.
 */
export function EvenColumns({
  pair,
  left,
  right,
  stack,
}: {
  pair?: readonly [ReactNode, ReactNode] | null
  left: ReactNode
  right: ReactNode
  stack: ReactNode
}) {
  const split = useEvenColumnsSplit()
  usePageWidth('page', AREA.homeSplit)
  if (!split) return <div className="mx-auto flex w-full max-w-main flex-col gap-4.5">{stack}</div>
  return (
    <div className="grid grid-cols-2 gap-5" data-even-columns>
      {/* обёртка-сетка растягивает карточку пары на высоту ряда */}
      {pair?.map((cell, i) => (
        <div key={i} className="grid min-w-0">
          {cell}
        </div>
      ))}
      <div className="flex min-w-0 flex-col gap-3 self-start">{left}</div>
      <div className="flex min-w-0 flex-col gap-3 self-start">{right}</div>
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
