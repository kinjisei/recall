// ============================================================================
// Карточка ученика справа от списка (на телефоне — отдельным экраном; макеты
// t6, t7-1, d3): шапка с меню, блок «Уроки» (остаток, оплата, история —
// features/schedule, Ф2.8), под ним студия ученика в приложении или
// приглашение в Recall. Вынесена из StudentsTab: вкладка упиралась в предел
// размера компонента.
//
// Плитка студии открывает раздел ВМЕСТО карточки (Ф2.11б-2): экран раздела с
// «‹ Имя», прокрутка — наверх; назад — карточка, прокрутка — к плиткам.
// Диагностика грузится здесь, а не в студии: её берут и плашки, и разделы, и
// отчёт — переход туда и обратно не перечитывает её с нуля; после раздела
// (выдали слова, назначили квест) — перечитывает, не стирая с экрана.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import type { LessonBalance } from '../../domains/schedule'
import { cardTakesSeat, outsideSeats, type CardAction, type StudentCard } from '../../domains/students'
import { CardLessons } from '../schedule'
import { CardHead, InviteBlock } from '../students'
import type { MyPlan } from '../../lib/billing'
import { getStudentDiagnostics } from '../../lib/diagnostics'
import type { StudentInfo } from '../../lib/teacher'
import { useAsyncData } from '../../shared/lib/useAsyncData'
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

  if (section && student) {
    return (
      <div ref={root}>
        <StudioSectionScreen
          section={section}
          student={student}
          name={card.name}
          diag={diag.data}
          diagError={diag.error}
          onRetryDiag={diag.reload}
          onBack={() => setSection(null)}
        />
      </div>
    )
  }
  return (
    <div ref={root} className="flex flex-col gap-4" key={card.id}>
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
      <CardLessons card={card} balance={balance} canWrite={canWrite} autoRemind={autoRemind} onRemindShown={onRemindShown} onChanged={onBalances} />
      {student ? (
        <StudentStudio
          student={student}
          name={card.name}
          diag={diag.data}
          diagLoading={diag.loading && !diag.data}
          tilesRef={tiles}
          onOpen={setSection}
          onChanged={onChanged}
          covered={card.holdsSeat}
          seatsKnown={seatsLimited && cardTakesSeat(card.status)}
        />
      ) : card.status === 'archived' ? (
        <p className="text-sm text-fg-muted">Ученик в архиве: история сохранена. Чтобы пригласить в приложение, верни из архива.</p>
      ) : (
        <>
          <InviteBlock card={card} seats={plan} />
          <p className="text-sm text-fg-muted">ⓘ Домашка и успехи появятся, когда {card.name} войдёт в приложение.</p>
        </>
      )}
    </div>
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
