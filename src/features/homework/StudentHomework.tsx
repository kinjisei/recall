// ============================================================================
// Домашка глазами ученика: один список вместо четырёх разных.
//
// До этого «что мне задали» собиралось из трёх экранов — задания на
// /assignments, квесты на /quests, письмо на /writing, — и ни один из них не
// знал про остальные. Ответа на вопрос «сколько мне ещё осталось» не было
// нигде, а именно он и решает, сядет человек заниматься или нет.
//
// ⚠️ ПРОГРЕСС ПОКАЗЫВАЕМ ВНУТРИ ПУНКТА, а не только галочкой после. «12 из 44»
// с полосой тянет закончить (эффект Зейгарника), а пустой кружок до самого
// конца выглядит как «я ещё даже не начинал» — хотя человек уже сделал треть.
//
// ⚠️ Экран НИЧЕГО не закрывает сам. Он указатель: пункт ведёт в тот же экран,
// где работа и делается (lib/homeworkLinks), а закрывает пункт СЕРВЕР по факту
// занятий. Единственное исключение — «своими словами»: там измерять нечем, и
// галочка ученика честно подписана.
// ============================================================================
import { useState } from 'react'
import { AppLink } from '../../shared/ui/AppLink'
import { Card } from '../../shared/ui/Card'
import { IconCheck } from '../../shared/ui/icons'
import {
  KIND_LABEL,
  chooseItem,
  completeItem,
  dueLabel,
  homeworkProgress,
  homeworkRows,
  isOverdue,
  type Homework,
  type HomeworkItem,
  type HomeworkRow,
} from '../../lib/homework'
import { KIND_HINT, homeworkLink } from '../../lib/homeworkLinks'

/** Тонкая полоса прогресса внутри пункта. */
function ItemBar({ progress, target }: { progress: number; target: number }) {
  const ratio = target > 0 ? Math.min(progress / target, 1) : 0
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tint/[0.08]">
      <div
        style={{ transform: `scaleX(${ratio})` }}
        className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
      />
    </div>
  )
}

/** Один вариант внутри пункта: заголовок, прогресс и переход к работе. */
function Variant({
  item,
  muted,
  onDone,
  busy,
}: {
  item: HomeworkItem
  /** Не выбранный вариант пары — показываем бледнее и без действия. */
  muted?: boolean
  onDone: (id: string) => void
  busy: boolean
}) {
  const link = homeworkLink(item)
  const done = !!item.done_at
  const started = !done && item.progress > 0 && item.target > 1

  return (
    <div className={muted ? 'opacity-45' : ''}>
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${
            done
              ? 'bg-accent-soft text-accent-soft-fg'
              : 'border border-tint/[0.14]'
          }`}
        >
          {done ? <IconCheck size={12} /> : ''}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] ${done ? 'text-fg-muted line-through' : ''}`}>
            {item.title}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {KIND_LABEL[item.kind]} · {done ? 'сделано' : KIND_HINT[item.kind]}
          </p>

          {/* ⚠️ Полоса только там, где есть что мерить (target > 1). У пункта
              «прочитать текст» цель одна, и полоса из двух состояний ничего не
              добавляет — только шум. */}
          {item.target > 1 && !done && (
            <>
              <ItemBar progress={item.progress} target={item.target} />
              <p className="mt-1 text-xs tabular-nums text-fg-secondary">
                {Math.min(item.progress, item.target)} из {item.target}
                {started && (
                  <span className="text-accent-strong">
                    {' '}
                    · осталось {item.target - item.progress}
                  </span>
                )}
              </p>
            </>
          )}

          {!done && !muted && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {link && (
                <AppLink
                  to={link.to}
                  className="inline-flex min-h-[40px] items-center rounded-xl bg-accent-soft px-3.5 text-sm font-medium text-accent-soft-fg"
                >
                  {link.label} →
                </AppLink>
              )}
              {/* Галочка — ТОЛЬКО там, где сервер измерить не может. Сервер и
                  сам откажет (RECALL_MEASURED_ITEM), но предлагать кнопку,
                  которая заведомо не сработает, нечестно. */}
              {item.kind === 'free' && (
                <button
                  onClick={() => onDone(item.id)}
                  disabled={busy}
                  className="inline-flex min-h-[40px] items-center rounded-xl border border-tint/[0.14] px-3.5 text-sm text-fg-secondary disabled:opacity-50"
                >
                  Отметить, что сделал
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Пара «на выбор»: пока ученик не выбрал — оба варианта равноправны. */
function PickRow({
  row,
  onChoose,
  onDone,
  busy,
}: {
  row: HomeworkRow
  onChoose: (id: string) => void
  onDone: (id: string) => void
  busy: boolean
}) {
  const chosen = row.chosen
  return (
    <li className="rounded-xl border border-accent-line/40 bg-accent-soft/25 p-3">
      <p className="mb-2 text-xs font-medium text-accent-soft-fg">
        {chosen ? 'Ты выбрал' : 'На выбор — сделай что-то одно'}
      </p>
      <div className="flex flex-col gap-3">
        {row.items.map((it) => (
          <div key={it.id}>
            <Variant
              item={it}
              muted={!!chosen && chosen.id !== it.id}
              onDone={onDone}
              busy={busy}
            />
            {/* Кнопка выбора только пока никто не выбран и группа не закрыта:
                после закрытия сервер всё равно откажет (RECALL_CHOICE_DONE). */}
            {!chosen && !row.done && (
              <button
                onClick={() => onChoose(it.id)}
                disabled={busy}
                className="ml-[30px] mt-1.5 text-sm font-medium text-accent-strong disabled:opacity-50"
              >
                Выбрать это
              </button>
            )}
          </div>
        ))}
      </div>
    </li>
  )
}

export function StudentHomework({
  hw,
  onChanged,
}: {
  hw: Homework
  /** Перечитать домашку после действия ученика. */
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = homeworkRows(hw)
  const { done, total } = homeworkProgress(hw)
  const overdue = isOverdue(hw)
  const ratio = total > 0 ? done / total : 0

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось — попробуй ещё раз')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Домашка на неделю</h2>
        <span className={`text-sm ${overdue ? 'text-warning-strong' : 'text-fg-muted'}`}>
          {dueLabel(hw.due_at)}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-tint/[0.08]">
          <div
            style={{ transform: `scaleX(${ratio})` }}
            className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
          />
        </div>
        <span className="text-sm tabular-nums text-fg-secondary">
          {done} из {total}
        </span>
      </div>

      {hw.note && (
        <p className="rounded-xl bg-tint/[0.04] px-3 py-2 text-sm text-fg-secondary">
          {hw.note}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger-strong">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) =>
          row.pickGroup != null && row.items.length > 1 ? (
            <PickRow
              key={row.items[0]!.id}
              row={row}
              busy={busy}
              onChoose={(id) => void act(() => chooseItem(id))}
              onDone={(id) => void act(() => completeItem(id))}
            />
          ) : (
            <li key={row.items[0]!.id}>
              <Variant
                item={row.items[0]!}
                busy={busy}
                onDone={(id) => void act(() => completeItem(id))}
              />
            </li>
          ),
        )}
      </ul>

      {/* Честная граница — та же, что видит преподаватель. Без неё «засчитано»
          читается как «проверено», а это разные вещи. */}
      <p className="text-xs text-fg-muted">
        Пункты закрываются сами по твоим занятиям — отмечать ничего не нужно.
      </p>
    </Card>
  )
}
