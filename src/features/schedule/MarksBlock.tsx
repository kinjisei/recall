// ============================================================================
// Кто был на уроке (макеты t4-2, t4-3; журнал п.27, 43): у каждого участника
// «На уроке / Не было», под выбором — «Списать / Не списывать» с остатком.
// Четыре отметки базы = две оси: был ли × списан ли («был, не списывать» —
// отработка; «не был, списать» — поздняя отмена). Пробному — без списаний.
// Кого не отметили, после урока спишет будильник; исправить можно задним
// числом — тем же нажатием. Что можно сейчас — allowedOutcomes (копия базы).
// ============================================================================
import {
  allowedOutcomes,
  balanceAfter,
  isCharged,
  outcomeOf,
  type Lesson,
  type LessonBalance,
  type LessonParticipant,
  type Outcome,
} from '../../domains/schedule'
import { Avatar } from '../students'
import { Button } from '../../shared/ui/Button'

type Side = 'present' | 'absent'
const sideOf = (o: Outcome | null): Side | null => (o === 'present' || o === 'present_free' ? 'present' : o ? 'absent' : null)
const outcomeFor = (side: Side, charge: boolean): Outcome =>
  side === 'present' ? (charge ? 'present' : 'present_free') : charge ? 'late_cancel' : 'absent'

/** Строка состояния под именем: что будет или уже случилось со списанием. */
function stateLine(lesson: Lesson, p: LessonParticipant): string | null {
  if (p.charge === null) {
    if (lesson.settled) return 'Урок прошёл без тарифа — отметь сам, был ли ученик'
    return p.trial ? 'Не отмечен · пробный не списывается' : 'Не отмечен — спишется автоматически'
  }
  if (p.trial) return 'Пробный — не списывается'
  if (p.chargeAuto && p.charge === 'charged') return 'Списан автоматически'
  return isCharged(p.charge) ? 'Списан' : 'Не списан'
}

function Participant({
  lesson,
  p,
  now,
  inApp,
  balance,
  canWrite,
  busy,
  onMark,
}: {
  lesson: Lesson
  p: LessonParticipant
  now: Date
  inApp: boolean
  balance: LessonBalance | null
  canWrite: boolean
  busy: boolean
  onMark: (cardId: string, outcome: Outcome) => void
}) {
  const allowed = allowedOutcomes(lesson, p, now)
  const current = outcomeOf(p)
  const side = sideOf(current)
  const charged = current !== null && isCharged(p.charge)
  const tracked = (balance?.paid ?? 0) > 0
  const pick = (next: Outcome) => {
    if (next !== current && allowed.includes(next)) onMark(p.cardId, next)
  }
  const sideBtn = (s: Side, label: string) => {
    const on = side === s
    // «На уроке» → «был, списать» (пробному — просто «был»); «Не было» → «не был»
    const target = s === 'present' ? 'present' : 'absent'
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={!canWrite || busy || !allowed.includes(target)}
        onClick={() => pick(target)}
        className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
          on ? 'bg-accent-soft text-accent-soft-fg ring-2 ring-control-line-active' : 'bg-tint/[0.06] text-fg-secondary ring-1 ring-control-line'
        }`}
      >
        {label}
      </button>
    )
  }
  const chargeBtn = (charge: boolean, label: string) => {
    if (!side) return null
    const target = outcomeFor(side, charge)
    if (!allowed.includes(target)) return null
    const on = current === target
    return (
      <button
        type="button"
        aria-pressed={on}
        disabled={!canWrite || busy}
        onClick={() => pick(target)}
        className={`flex min-h-12 flex-1 flex-col items-start justify-center rounded-xl px-3 py-1.5 text-left transition-colors disabled:opacity-50 ${
          on ? 'bg-accent-soft text-accent-soft-fg ring-2 ring-control-line-active' : 'bg-tint/[0.04] text-fg ring-1 ring-control-line'
        }`}
      >
        <span className="text-sm font-semibold">{label}</span>
        {tracked && balance && <span className="text-caption opacity-80">{balanceAfter(balance.balance, charged, charge)}</span>}
      </button>
    )
  }
  return (
    <li className="flex flex-col gap-2" data-mark={p.cardId}>
      <div className="flex items-center gap-3">
        <Avatar name={p.name} inApp={inApp} small />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {p.name}
            {!inApp && <span className="font-normal text-fg-muted"> · без приложения</span>}
          </p>
          <p className="text-caption text-fg-muted">{stateLine(lesson, p)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {sideBtn('present', 'На уроке')}
        {sideBtn('absent', 'Не было')}
      </div>
      {side && !p.trial && (
        <div className="flex gap-2" role="group" aria-label={`${p.name}: списать урок?`}>
          {chargeBtn(true, side === 'absent' ? 'Списать — поздняя отмена' : 'Списать')}
          {chargeBtn(false, 'Не списывать')}
        </div>
      )}
    </li>
  )
}

export function MarksBlock({
  lesson,
  now,
  inApp,
  balances,
  canWrite,
  busy,
  onMark,
  onAllPresent,
}: {
  lesson: Lesson
  now: Date
  inApp: (cardId: string) => boolean
  balances: Map<string, LessonBalance>
  canWrite: boolean
  busy: boolean
  onMark: (cardId: string, outcome: Outcome) => void
  onAllPresent: () => void
}) {
  const group = lesson.kind === 'group'
  const unmarked = lesson.participants.filter((p) => p.charge === null)
  return (
    <section aria-label="Кто был" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg-secondary">{group ? 'Кто был' : 'Был ли на уроке'}</h3>
        {group && unmarked.length > 1 && canWrite && (
          <Button variant="ghost" className="min-h-11 px-3 py-1 text-sm" disabled={busy} onClick={onAllPresent}>
            Все были
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-4">
        {lesson.participants.map((p) => (
          <Participant
            key={p.cardId}
            lesson={lesson}
            p={p}
            now={now}
            inApp={inApp(p.cardId)}
            balance={balances.get(p.cardId) ?? null}
            canWrite={canWrite}
            busy={busy}
            onMark={onMark}
          />
        ))}
      </ul>
      <p className="text-note text-fg-muted">
        {group
          ? 'Кого не отметишь — урок спишется автоматически. Исправить можно позже.'
          : 'Исправить можно и позже, задним числом — в этом уроке.'}
      </p>
    </section>
  )
}
