// ============================================================================
// Домашка в карточке ученика — то, ради чего преподаватель сюда и заходит.
//
// Раньше карточка была пятью текстовыми раскрывашками подряд, и по ней нельзя
// было ответить ни на один вопрос, который задают перед уроком: что задано,
// что сделано, о чём говорить сегодня. Теперь домашка стоит первой и сразу
// показывает счёт.
//
// ⚠️ Пометка «засчитано» / «отметил сам» — не украшение. Пункт, закрытый
// сервером по факту занятий, и пункт, отмеченный галочкой, значат разное, и
// планировать урок по ним нужно по-разному. Формулировка «засчитано по
// занятиям», а не «проверено»: расписание повторений пишет клиент, и обещать
// больше мы не имеем права (см. lib/homework.ts).
// ============================================================================
import { useEffect, useState } from 'react'
import { RowsSkeleton } from '../../components/Loading'
import { IconCheck, IconFlame, IconSparkle } from '../../components/icons'
import {
  KIND_LABEL,
  dueLabel,
  getHomework,
  homeworkProgress,
  isOverdue,
  type Homework,
  type HomeworkItem,
} from '../../lib/homework'

/** Одна строка пункта: что задано, сделано ли и кто это засчитал. */
function ItemRow({ item }: { item: HomeworkItem }) {
  const done = !!item.done_at
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${
          done
            ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
            : 'border border-white/[0.14] text-[var(--night-text-40)]'
        }`}
      >
        {done ? <IconCheck size={12} /> : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${done ? 'text-[var(--night-text-70)]' : ''}`}>
          {item.title}
        </span>
        <span className="text-xs text-[var(--night-text-40)]">
          {KIND_LABEL[item.kind]}
          {item.target > 1 && ` · ${Math.min(item.progress, item.target)} из ${item.target}`}
          {done && (item.done_by === 'student' ? ' · отметил сам' : ' · засчитано по занятиям')}
        </span>
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
  const [hw, setHw] = useState<Homework | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getHomework(studentId)
      .then((h) => alive && setHw(h))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Не удалось прочитать домашку'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [studentId, reloadKey])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
        <RowsSkeleton count={3} height={28} />
      </div>
    )
  }

  const { done, total } = homeworkProgress(hw)
  const overdue = isOverdue(hw)
  const ratio = total > 0 ? done / total : 0

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
      {error && <p className="mb-2 text-sm text-amber-300">{error}</p>}

      {!hw ? (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium">Домашки нет</p>
          <p className="text-sm text-[var(--night-text-40)]">
            Между уроками ученик занимается сам — или не занимается. Домашка на неделю решает,
            что именно он откроет.
          </p>
          <ComposeButton onClick={onCompose} label="Собрать домашку" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-medium">Домашка на неделю</p>
            <p className={`text-sm ${overdue ? 'text-amber-300' : 'text-[var(--night-text-40)]'}`}>
              {dueLabel(hw.due_at)}
            </p>
          </div>

          {/* Полоса — тем же приёмом, что EnergyBar: масштабируем, а не меняем
              ширину. Так анимация идёт на transform и не вызывает пересчёт
              раскладки. */}
          <div className="flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                style={{ transform: `scaleX(${ratio})` }}
                className="h-full w-full origin-left rounded-full bg-[var(--night-accent)] transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
              />
            </div>
            <span className="text-sm tabular-nums text-[var(--night-text-70)]">
              {done} из {total}
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-white/[0.05]">
            {hw.items.map((i) => (
              <ItemRow key={i.id} item={i} />
            ))}
          </ul>

          {hw.note && (
            <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-[var(--night-text-70)]">
              {hw.note}
            </p>
          )}

          <ComposeButton onClick={onCompose} label="Собрать новую домашку" />
        </div>
      )}
    </div>
  )
}

/** Главное действие экрана — поэтому кнопка одна и заметная. */
function ComposeButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="lift flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,rgba(145,132,217,.9),rgba(120,105,205,.9))] px-4 font-semibold text-white transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
    >
      <IconSparkle size={18} /> {label}
    </button>
  )
}

/** Три числа, за которыми преподаватель и приходит: где буксует, где слабо, как часто занимается. */
export function StatTiles({
  struggling,
  weakTopics,
  activeDays,
  loading,
}: {
  struggling: number
  weakTopics: number
  activeDays: number
  loading: boolean
}) {
  const tiles = [
    { value: struggling, label: 'буксуют слов' },
    { value: weakTopics, label: 'слабых тем' },
    { value: `${activeDays}/14`, label: 'дней с занятиями', icon: true },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/[0.08] bg-[var(--night-surface)] px-2 py-3 text-center"
        >
          <p className="text-xl font-bold tabular-nums">
            {loading ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-white/[0.08]" /> : t.value}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--night-text-40)]">
            {t.icon && <IconFlame size={11} className="mr-0.5 inline align-text-bottom" />}
            {t.label}
          </p>
        </div>
      ))}
    </div>
  )
}
