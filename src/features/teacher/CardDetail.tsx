// ============================================================================
// Карточка ученика справа от списка (на телефоне — отдельным экраном; макеты
// t6, t7-1, d3): шапка с меню, блок «Уроки» (остаток, оплата, история —
// features/schedule, Ф2.8), под ним студия ученика в приложении или
// приглашение в Recall. Вынесена из StudentsTab: вкладка упиралась в предел
// размера компонента.
// ============================================================================
import type { LessonBalance } from '../../domains/schedule'
import { cardTakesSeat, outsideSeats, type CardAction, type StudentCard } from '../../domains/students'
import { CardLessons } from '../schedule'
import { CardHead, InviteBlock } from '../students'
import type { MyPlan } from '../../lib/billing'
import type { StudentInfo } from '../../lib/teacher'
import { StudentStudio } from './StudentStudio'
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
  return (
    <div className="flex flex-col gap-4" key={card.id}>
      <CardHead
        card={card}
        level={info?.profile.level ?? null}
        outside={outsideSeats(card, seatsLimited)}
        canWrite={canWrite}
        busy={busy}
        onBack={onBack}
        onAction={onAction}
      />
      {actionError && <p className="text-sm text-danger-soft-fg">{actionError}</p>}
      <CardLessons card={card} balance={balance} canWrite={canWrite} autoRemind={autoRemind} onRemindShown={onRemindShown} onChanged={onBalances} />
      {card.inApp && info ? (
        <StudentStudio student={info} name={card.name} onChanged={onChanged} covered={card.holdsSeat} seatsKnown={seatsLimited && cardTakesSeat(card.status)} />
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
