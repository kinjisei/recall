// ============================================================================
// Карточка ученика справа от списка (на телефоне — отдельным экраном; макеты
// t6-2…t6-4, t7-1, d10-1; PLAN.md Ф2.17-4б-2): шапка с меню; у ученика в
// приложении — студия: «Уроки» (остаток, оплата, история — features/schedule,
// Ф2.8) и рядом домашка с плашками, ниже «Разделы»; у карточки без приложения
// — «Пригласить в Recall», под ним «Уроки» (t6-4). На компьютере карточка —
// своя рамка во всю высоту (фон страницы, тонкая рамка, d10-1), и раскладка
// внутри смотрит на её ширину (контейнер), а не на окно. Вынесена из
// StudentsTab: вкладка упиралась в предел размера компонента.
//
// Плитка студии открывает раздел ВМЕСТО карточки (Ф2.11б-2): экран раздела с
// «‹ Имя», прокрутка — наверх; назад — карточка, прокрутка — к плиткам.
// Диагностика грузится здесь, а не в студии: её берут и плашки, и разделы, и
// отчёт — переход туда и обратно не перечитывает её с нуля; после раздела
// (выдали слова, назначили квест) — перечитывает, не стирая с экрана.
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { lastLessonOf, type Lesson, type LessonBalance, type Series } from '../../domains/schedule'
import { cardTakesSeat, outsideSeats, type CardAction, type StudentCard } from '../../domains/students'
import { CardLessons } from '../schedule'
import { CardHead, InviteBlock } from '../students'
import type { MyPlan } from '../../lib/billing'
import { getStudentDiagnostics } from '../../lib/diagnostics'
import type { StudentInfo } from '../../lib/teacher'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { IconInfo } from '../../shared/ui/icons'
import { GOAL_LABELS } from '../../types'
import { StudentStudio } from './StudentStudio'
import { StudioSectionScreen } from './StudioSection'
import { useStudioSection } from './studioSections'
import { useInnerScreen } from './innerScreen'

export function CardDetail({
  card,
  info,
  plan,
  balance,
  lessons,
  series,
  canWrite,
  busy,
  actionError,
  autoRemind,
  onRemindShown,
  onBack,
  onAction,
  onChanged,
  onBalances,
}: {
  card: StudentCard
  info: StudentInfo | null
  plan: MyPlan | null
  balance: LessonBalance | null
  /** Уроки вокруг сегодня и серии студии (вкладка «Ученики»): блок «Уроки». */
  lessons: Lesson[] | null
  series: Series[] | null
  canWrite: boolean
  busy: boolean
  actionError: string | null
  autoRemind: boolean
  onRemindShown: () => void
  /** Телефон: «‹ Ученики»; компьютер — undefined. */
  onBack?: () => void
  onAction: (a: CardAction) => void
  onChanged: () => void
  /** Оплата или исправление — перечитать остатки списка. */
  onBalances: () => void
}) {
  const seatsLimited = typeof plan?.seats === 'number' && !plan.is_admin
  // на телефоне карточка — экран со своим «‹ Ученики»: шапку страницы прячем (макет t6-2)
  useInnerScreen(!!onBack)
  const student = card.inApp ? info : null
  const [section, setSection] = useStudioSection()
  const [diagVersion, setDiagVersion] = useState(0)
  // Сбой — плашки и плитки покажут «—» вместо чисел: карточка из-за них не падает.
  const diag = useAsyncData(
    () => (student ? getStudentDiagnostics(student.profile.id) : Promise.resolve(null)),
    [student?.profile.id, diagVersion],
    'Не удалось загрузить диагностику',
  )
  const root = useRef<HTMLDivElement>(null)
  const tiles = useRef<HTMLDivElement>(null)
  useSectionScroll(section, root, tiles, () => setDiagVersion((v) => v + 1))

  // компьютер: своя рамка во всю высоту (d10-1); телефон — экран без рамки.
  // Раздел — та же рамка без полей: шапка раздела во всю ширину и держится
  // сверху (overflow-clip, а не hidden: hidden сломал бы sticky).
  const wide = !onBack
  const box = '@container min-h-full rounded-row bg-page ring-1 ring-inset ring-line'
  const frame = wide ? `${box} p-5` : '@container'
  const cardLessons = (
    <CardLessons
      card={card}
      balance={balance}
      lessons={lessons}
      series={series}
      canWrite={canWrite}
      autoRemind={autoRemind}
      onRemindShown={onRemindShown}
      onChanged={onBalances}
    />
  )

  if (section && student) {
    return (
      <div ref={root} className={wide ? `${box} flex flex-col overflow-clip` : '@container'}>
        <StudioSectionScreen
          section={section}
          student={student}
          name={card.name}
          diag={diag.data}
          balance={balance}
          last={lessons ? lastLessonOf(lessons, card.id, new Date()) : null}
          wide={wide}
          diagError={diag.error}
          onRetryDiag={diag.reload}
          onSection={setSection}
          onBack={() => setSection(null)}
        />
      </div>
    )
  }
  return (
    <div ref={root} className={`${frame} flex flex-col gap-4`} key={card.id}>
      <CardHead
        card={card}
        level={info?.profile.level ?? null}
        goal={info?.profile.goal ? GOAL_LABELS[info.profile.goal] : null}
        outside={outsideSeats(card, seatsLimited)}
        canWrite={canWrite}
        busy={busy}
        onBack={onBack}
        onAction={onAction}
      />
      {actionError && <p className="text-sm text-danger-soft-fg">{actionError}</p>}
      {student ? (
        <StudentStudio
          student={student}
          name={card.name}
          lessons={cardLessons}
          diag={diag.data}
          diagLoading={diag.loading && !diag.data}
          tilesRef={tiles}
          onOpen={setSection}
          onChanged={onChanged}
          covered={card.holdsSeat}
          seatsKnown={seatsLimited && cardTakesSeat(card.status)}
        />
      ) : card.status === 'archived' ? (
        <>
          {cardLessons}
          <Note>Ученик в архиве: история сохранена. Чтобы пригласить в приложение, верни из архива.</Note>
        </>
      ) : (
        <>
          {/* приглашение — выше «Уроков» (t6-4): главное, что можно сделать с такой карточкой */}
          <InviteBlock card={card} seats={plan} />
          {cardLessons}
          <Note>Домашка и успехи появятся, когда {card.name} войдёт в приложение.</Note>
        </>
      )}
    </div>
  )
}

/** Тихая строка с «i» (t6-3, t6-4). */
function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 px-1 text-note text-fg-muted">
      <IconInfo size={15} aria-hidden className="mt-0.5 flex-none" />
      <span>{children}</span>
    </p>
  )
}

/**
 * Открыли раздел — его начало наверху панели (компьютер) или экрана (телефон),
 * а не там, где была плитка. Вернулись — к плиткам, а не в начало карточки.
 */
function useSectionScroll(
  section: string | null,
  root: React.RefObject<HTMLDivElement | null>,
  tiles: React.RefObject<HTMLDivElement | null>,
  onLeft: () => void,
) {
  const prev = useRef(section)
  useEffect(() => {
    const was = prev.current
    prev.current = section
    if (was === section) return
    const pane = root.current?.closest<HTMLElement>('[data-pane="detail"]')
    if (section) {
      if (pane) pane.scrollTop = 0
      else window.scrollTo({ top: 0 })
    } else if (was) {
      tiles.current?.scrollIntoView({ block: 'center' })
      onLeft()
    }
    // onLeft — новая функция на каждую отрисовку; важна только смена раздела
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])
}
