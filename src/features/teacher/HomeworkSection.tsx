// ============================================================================
// Домашка в карточке ученика — то, ради чего преподаватель сюда и заходит.
//
// Раньше карточка была пятью текстовыми раскрывашками подряд, и по ней нельзя
// было ответить ни на один вопрос, который задают перед уроком: что задано,
// что сделано, о чём говорить сегодня. Теперь домашка стоит первой и сразу
// показывает счёт — как в макете t6-2: «3 из 5 заданий · осталось 2», срок
// той же подписью, что в строке списка (dueShort), под счётом — пункты.
//
// ⚠️ Пометка «засчитано» / «отметил сам» — не украшение. Пункт, закрытый
// сервером по факту занятий, и пункт, отмеченный галочкой, значат разное, и
// планировать урок по ним нужно по-разному. Формулировка «засчитано по
// занятиям», а не «проверено»: расписание повторений пишет клиент, и обещать
// больше мы не имеем права (см. lib/homework.ts).
// ============================================================================
import { RowsSkeleton } from '../../shared/ui/Loading'
import { LoadError } from '../../shared/ui/LoadError'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { readDraft } from '../../shared/lib/drafts'
import { composerDraft } from './useComposerDraft'
import { plural } from '../../shared/lib/plural'
import { IconCheck } from '../../shared/ui/icons'
import {
  KIND_LABEL,
  dueShort,
  getHomework,
  homeworkProgress,
  homeworkRows,
  isOverdue,
  type HomeworkRow,
} from '../../lib/homework'

/**
 * Одна строка домашки: обычный пункт или пара «на выбор».
 *
 * ⚠️ У пары показываем оба варианта и помечаем, что выбрал ученик. Без пометки
 * преподаватель ждал бы выполнения обоих и счёл бы сделанное невыполнением —
 * то есть выбор, который должен был помочь, вредил бы.
 */
function ItemRow({ row }: { row: HomeworkRow }) {
  const done = row.done
  const pair = row.pickGroup != null && row.items.length > 1
  const head = pair ? (row.chosen ?? row.items[0]!) : row.items[0]!
  const other = pair ? row.items.filter((i) => i.id !== head.id) : []

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${
          done
            ? 'bg-accent-soft text-accent-soft-fg'
            : 'border border-tint/[0.14] text-fg-muted'
        }`}
      >
        {done ? <IconCheck size={12} /> : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${done ? 'text-fg-secondary' : ''}`}>
          {head.title}
        </span>
        <span className="text-xs text-fg-muted">
          {KIND_LABEL[head.kind]}
          {head.target > 1 && ` · ${Math.min(head.progress, head.target)} из ${head.target}`}
          {done && (head.done_by === 'student' ? ' · отметил сам' : ' · засчитано по занятиям')}
          {pair && (row.chosen ? ' · выбрал ученик' : ' · на выбор, ещё не выбрал')}
        </span>
        {pair &&
          other.map((o) => (
            <span key={o.id} className="block text-xs text-fg-muted">
              вместо: {o.title}
            </span>
          ))}
      </span>
    </li>
  )
}

/**
 * Блок домашки. Пока грузится — скелетон ТОЙ ЖЕ высоты: иначе кнопка «Собрать
 * домашку» прыгает под пальцем ровно в тот момент, когда по ней целятся.
 */
export function HomeworkSection({
  studentId,
  onCompose,
  reloadKey = 0,
}: {
  studentId: string
  onCompose: () => void
  /** Меняется после выдачи — перечитываем, не перезагружая карточку целиком. */
  reloadKey?: number
}) {
  // Сбой — плашка с «Повторить», а не «Домашки нет» с кнопкой «Собрать»:
  // учитель собрал бы новую поверх существующей (PLAN.md Ф1.13).
  const { data: hw, error, loading, reload } = useAsyncData(
    () => getHomework(studentId),
    [studentId, reloadKey],
    'Не удалось прочитать домашку',
  )

  if (error) {
    return <LoadError message={error} onRetry={reload} />
  }
  // сборка не выдана, а черновик жив — кнопка зовёт его продолжить (Ф1.14)
  const composing = readDraft(composerDraft(studentId)) !== null

  const block = 'flex flex-col gap-3 rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card'
  if (loading) {
    return (
      <section className={block}>
        <RowsSkeleton count={3} height={28} />
      </section>
    )
  }

  const { done, total } = homeworkProgress(hw)
  const overdue = isOverdue(hw)
  const ratio = total > 0 ? done / total : 0

  return (
    <section className={block} aria-label="Домашка на неделю" data-homework>
      <h3 className="flex items-baseline justify-between gap-2 font-semibold">
        Домашка на неделю
        {hw && (
          <small className={`text-note font-medium ${overdue ? 'text-warning-strong' : 'text-fg-muted'}`}>{dueShort(hw.due_at)}</small>
        )}
      </h3>
      {!hw ? (
        <>
          <p className="text-[15px] text-fg-secondary">Пока не задана.</p>
          <ComposeButton onClick={onCompose} label={composing ? 'Продолжить сборку' : 'Собрать домашку'} />
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2 text-[15px] tabular-nums">
            <span>
              <b className="font-semibold">
                {done} из {total}
              </b>{' '}
              {plural(total, 'задания', 'заданий', 'заданий')}
            </span>
            {total > done && <span className="text-sm text-fg-muted">осталось {total - done}</span>}
          </div>

          {/* Полоса — тем же приёмом, что EnergyBar: масштабируем, а не меняем
              ширину. Так анимация идёт на transform и не вызывает пересчёт
              раскладки. */}
          <div className="h-2 overflow-hidden rounded-full bg-tint/[0.08]">
            <div
              style={{ transform: `scaleX(${ratio})` }}
              className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
            />
          </div>

          <ul className="flex flex-col divide-y divide-tint/[0.05]">
            {homeworkRows(hw).map((row) => (
              <ItemRow key={row.items[0]!.id} row={row} />
            ))}
          </ul>

          {hw.note && (
            <p className="rounded-xl bg-tint/[0.04] px-3 py-2 text-sm text-fg-secondary">
              {hw.note}
            </p>
          )}

          <ComposeButton onClick={onCompose} label={composing ? 'Продолжить сборку' : 'Собрать домашку'} />
        </>
      )}
    </section>
  )
}

/** Главное действие карточки — кнопка одна, на всю ширину (мягкая, как в макете t6-2). */
function ComposeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="lift flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-accent-soft px-4 text-base font-semibold text-accent-soft-fg transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
    >
      {label}
    </button>
  )
}
