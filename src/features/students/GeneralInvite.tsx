// ============================================================================
// «Пригласить по общему коду» — в шторке «+ Ученик» (PLAN.md Ф2.11б-2). Под
// списком учеников — только строка «Общий код: U5J 34H · Скопировать», всё
// остальное здесь: что это за код, сообщение с кнопками (то же, что у карточки,
// без имени — InviteShare) и «Сменить код». Код и смену держит экран
// (features/teacher/TeacherPage): строка и шторка показывают один и тот же.
// ============================================================================
import { Button } from '../../shared/ui/Button'
import { InviteShare } from './InviteBlock'

export function GeneralInvite({
  code,
  regenerating,
  onRegenerate,
}: {
  /** null — ещё не загрузился. */
  code: string | null
  regenerating: boolean
  onRegenerate: () => void
}) {
  return (
    <div className="flex flex-col gap-3" data-general-invite>
      <p className="text-sm text-fg-secondary">
        Один код на всех. Ученик открывает ссылку или вводит код у себя на Главной — и сам появляется
        в твоём списке. Того, кто уже есть в списке, приглашай из его карточки: так ученик
        попадёт ровно в неё.
      </p>
      {code ? (
        <InviteShare name={null} code={code} event="general_invite_share" />
      ) : (
        <div className="h-24 animate-pulse rounded-xl bg-tint/[0.05]" />
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-tint/[0.06] pt-3">
        <Button variant="ghost" className="min-h-11 px-3 py-2 text-sm" loading={regenerating} onClick={onRegenerate}>
          Сменить код
        </Button>
        <span className="text-xs text-fg-muted">если код попал не тем — старый перестанет работать</span>
      </div>
    </div>
  )
}
