// ============================================================================
// Сборка домашки руками: срок и список пунктов.
//
// Это первый шаг: подбор «за меня» по диагностике появится следующим заходом.
// Но даже ручная сборка уже решает главную боль — раньше, чтобы задать
// домашнее, преподаватель обходил четыре разных раздела, и после этого всё
// равно не мог посмотреть, сделано ли.
//
// ⚠️ Заготовка недели — не «шаблон на все случаи», а напоминание о балансе:
// повторение + чтение + продуктивное задание. Перекос в одну сторону — самая
// частая ошибка в домашке, и её проще не допустить, чем потом заметить.
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { IconClose, IconPlus, IconTrash } from '../../components/icons'
import { KIND_LABEL, createHomework, type HomeworkKind, type NewHomeworkItem } from '../../lib/homework'
import type { AppLang } from '../../types'

/** Через сколько дней срок по умолчанию: неделя — обычный шаг между уроками. */
const DEFAULT_DAYS = 7

/** Порядок в списке выбора: сперва то, что задают чаще. */
const KINDS: HomeworkKind[] = ['words', 'text', 'writing', 'speech', 'quest', 'free']

/** Разумная цель по умолчанию для каждого типа — чтобы не заполнять руками. */
const DEFAULT_TARGET: Record<HomeworkKind, number> = {
  words: 20,
  text: 1,
  writing: 1,
  speech: 5,
  quest: 1,
  free: 1,
}

const SUGGESTED: NewHomeworkItem[] = [
  { kind: 'words', title: 'Повторить слова', target: 20 },
  { kind: 'text', title: 'Прочитать текст и разобрать незнакомое', target: 1 },
  { kind: 'writing', title: 'Написать короткий текст', target: 1 },
]

function isoDatePlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function HomeworkComposer({
  studentId,
  studentName,
  lang,
  onClose,
  onCreated,
}: {
  studentId: string
  studentName: string
  lang: AppLang
  onClose: () => void
  onCreated: () => void
}) {
  const [due, setDue] = useState(isoDatePlus(DEFAULT_DAYS))
  const [note, setNote] = useState('')
  const [items, setItems] = useState<NewHomeworkItem[]>(SUGGESTED)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = (i: number, next: Partial<NewHomeworkItem>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...next } : it)))
  const remove = (i: number) => setItems((cur) => cur.filter((_, idx) => idx !== i))
  const add = () =>
    setItems((cur) => [...cur, { kind: 'free', title: '', target: DEFAULT_TARGET.free }])

  const ready = items.length > 0 && items.every((i) => i.title.trim().length > 0)

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await createHomework({
        studentId,
        lang,
        due: new Date(`${due}T23:59:00`),
        items: items.map((i) => ({ ...i, title: i.title.trim() })),
        note: note.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выдать домашку')
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="animate-fade-up flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />

        <div className="flex items-start justify-between gap-2 px-5 pt-1">
          <div className="min-w-0">
            <h2 className="text-lg font-medium">Домашка для {studentName}</h2>
            <p className="mt-0.5 text-sm text-[var(--night-text-40)]">
              Короткие задания чаще работают лучше одного длинного
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--night-text-40)]"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <label htmlFor="hw-due" className="block text-sm font-medium">
            Сдать до
          </label>
          <input
            id="hw-due"
            type="date"
            value={due}
            min={isoDatePlus(0)}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3.5 text-sm outline-none focus:border-[var(--night-accent-45)]"
          />

          <p className="mt-4 text-sm font-medium">Задания</p>
          <ul className="mt-2 flex flex-col gap-2">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Тип задания"
                    value={it.kind}
                    onChange={(e) => {
                      const kind = e.target.value as HomeworkKind
                      patch(i, { kind, target: DEFAULT_TARGET[kind] })
                    }}
                    className="h-11 flex-none rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-2 text-sm"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Что сделать"
                    value={it.title}
                    placeholder="Что сделать"
                    onChange={(e) => patch(i, { title: e.target.value })}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 text-sm outline-none focus:border-[var(--night-accent-45)]"
                  />
                  <button
                    onClick={() => remove(i)}
                    aria-label="Убрать задание"
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[var(--night-text-40)] hover:text-rose-300"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>

                {/* «Своими словами» измерить нечем — цель там всегда одна, и
                    поле только сбивало бы с толку. */}
                {it.kind !== 'free' && (
                  <label className="flex items-center gap-2 text-xs text-[var(--night-text-40)]">
                    Сколько нужно
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={it.target ?? 1}
                      onChange={(e) =>
                        patch(i, { target: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })
                      }
                      className="h-9 w-20 rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-2 text-sm text-[var(--night-text)]"
                    />
                  </label>
                )}

                {it.kind === 'free' && (
                  <p className="text-xs text-[var(--night-text-40)]">
                    Такое приложение измерить не может — ученик отметит сам, и в карточке будет
                    видно, что это его отметка
                  </p>
                )}
              </li>
            ))}
          </ul>

          <button
            onClick={add}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] text-sm text-[var(--night-text-40)] hover:text-[var(--night-text-70)]"
          >
            <IconPlus size={16} /> Добавить задание
          </button>

          <label htmlFor="hw-note" className="mt-4 block text-sm font-medium">
            Заметка ученику
          </label>
          <input
            id="hw-note"
            value={note}
            placeholder="Например: сперва слова, потом текст"
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3.5 text-sm outline-none focus:border-[var(--night-accent-45)]"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-white/[0.06] px-5 py-3">
          <Button className="w-full py-3" disabled={!ready} loading={busy} onClick={send}>
            {items.length > 0 ? `Выдать домашку · ${items.length}` : 'Выдать домашку'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
