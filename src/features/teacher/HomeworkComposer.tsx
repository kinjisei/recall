// ============================================================================
// Сборка домашки: приложение предлагает набор, преподаватель правит.
//
// ⚠️ Главное про этот экран: он НЕ решает, что задать. Состав считает
// lib/homeworkRules по состояниям FSRS и диагностике, формулировки пишет
// модель (lib/homeworkSuggest). Здесь только показ и правка — иначе появилось
// бы второе место, где живут правила, и оно бы разошлось с первым.
//
// ⚠️ У каждого предложенного пункта показываем «почему». Преподаватель должен
// иметь возможность НЕ поверить: цифра без основания либо принимается на веру,
// либо игнорируется целиком, и оба исхода плохи. «12 карточек ждут повторения»
// проверяемо, «оптимальный объём» — нет.
//
// ⚠️ Два пункта идут НА ВЫБОР ученику. Возможность выбрать повышает шанс, что
// задание вообще сделают, но только если выбор виден обеим сторонам: без
// пометки преподаватель ждал бы оба, а получил один и счёл это невыполнением.
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { Thinking } from '../../components/Thinking'
import { IconClose, IconPlus, IconSparkle, IconTrash } from '../../components/icons'
import { KIND_LABEL, createHomework, type HomeworkKind } from '../../lib/homework'
import { countableItems, MAX_ITEMS } from '../../lib/homeworkRules'
import { suggestHomework, type SuggestedItem } from '../../lib/homeworkSuggest'
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

/**
 * Набор до подбора — напоминание о балансе: повторение + чтение + продуктивное.
 * Перекос в одну сторону самая частая ошибка в домашке, и её проще не
 * допустить, чем потом заметить.
 */
const STARTER: SuggestedItem[] = [
  { kind: 'words', title: 'Повторить слова', target: 20, why: '' },
  { kind: 'text', title: 'Прочитать текст и разобрать незнакомое', target: 1, why: '' },
  { kind: 'writing', title: 'Написать короткий текст', target: 1, why: '' },
]

function isoDatePlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Дней до срока — от него зависит объём набора, поэтому считаем честно. */
function daysUntil(iso: string): number {
  const diff = new Date(`${iso}T23:59:00`).getTime() - Date.now()
  return Math.max(1, Math.round(diff / 86_400_000))
}

export function HomeworkComposer({
  studentId,
  studentName,
  lang,
  level = null,
  onClose,
  onCreated,
}: {
  studentId: string
  studentName: string
  lang: AppLang
  /** Уровень ученика — от него зависит подбор текста. null = не измерен. */
  level?: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [due, setDue] = useState(isoDatePlus(DEFAULT_DAYS))
  const [note, setNote] = useState('')
  const [items, setItems] = useState<SuggestedItem[]>(STARTER)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<null | { fromAi: boolean; days: number }>(null)
  const [error, setError] = useState<string | null>(null)

  const patch = (i: number, next: Partial<SuggestedItem>) =>
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...next } : it)))
  const remove = (i: number) => setItems((cur) => cur.filter((_, idx) => idx !== i))
  const add = () =>
    setItems((cur) => [...cur, { kind: 'free', title: '', target: DEFAULT_TARGET.free, why: '' }])

  const ready = items.length > 0 && items.every((i) => i.title.trim().length > 0)
  const countable = countableItems(items)

  const pick = async () => {
    setPicking(true)
    setError(null)
    try {
      const s = await suggestHomework(studentId, lang, level, daysUntil(due))
      setItems(s.items)
      setNote(s.note)
      setPicked({ fromAi: s.fromAi, days: daysUntil(due) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подобрать набор')
    } finally {
      setPicking(false)
    }
  }

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await createHomework({
        studentId,
        lang,
        due: new Date(`${due}T23:59:00`),
        items: items.map((i) => ({
          kind: i.kind,
          title: i.title.trim(),
          target: i.target,
          pickGroup: i.pickGroup,
        })),
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

          {/* Подбор — главное действие формы, поэтому стоит до списка: сперва
              предложение, потом правка, а не наоборот. */}
          <button
            onClick={pick}
            disabled={picking}
            className="lift mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--night-accent-45)] bg-[var(--night-accent-900)] px-4 text-sm font-semibold text-[var(--night-accent-100)] transition-[filter,transform] active:scale-[0.99] disabled:opacity-60"
          >
            {picking ? (
              <Thinking label="Смотрю, что у ученика буксует" />
            ) : (
              <>
                <IconSparkle size={18} /> Подобрать под ученика
              </>
            )}
          </button>

          {picked && picked.days !== daysUntil(due) && (
            // ⚠️ Объём набора считается ОТ СРОКА. Сдвинули дату после подбора —
            // числа в пунктах и в объяснениях относятся к прежнему сроку, и
            // молчать об этом нельзя: они выглядят как посчитанные только что.
            <p className="mt-2 text-xs text-amber-300">
              Срок изменился — подбери заново, иначе числа останутся от прежнего.
            </p>
          )}

          {picked && (
            <p className="mt-2 text-xs text-[var(--night-text-40)]">
              Состав посчитан по словам и ошибкам ученика
              {picked.fromAi
                ? '; формулировки — AI (списано из месячных генераций).'
                : '. AI не ответил, формулировки наши — состав от этого не зависит.'}
            </p>
          )}

          <div className="mt-4 flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Задания</p>
            <p className="text-xs text-[var(--night-text-40)]">
              {countable} к выполнению
              {countable !== items.length && ` · ${items.length} строк`}
            </p>
          </div>

          <ul className="mt-2 flex flex-col gap-2">
            {items.map((it, i) => {
              const inGroup = it.pickGroup != null
              const firstInGroup =
                inGroup && items.findIndex((x) => x.pickGroup === it.pickGroup) === i
              return (
                <li
                  key={i}
                  className={`flex flex-col gap-2 rounded-xl border p-3 ${
                    inGroup
                      ? 'border-[var(--night-accent-45)]/40 bg-[var(--night-accent-900)]/30'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  {firstInGroup && (
                    <p className="text-xs font-medium text-[var(--night-accent-100)]">
                      На выбор — ученик сделает одно из двух
                    </p>
                  )}
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
                          patch(i, {
                            target: Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                          })
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

                  {/* Основание пункта. Без него подбор — это «приложение так
                      решило», а с ним преподаватель может проверить и не
                      согласиться. */}
                  {it.why && (
                    <p className="text-xs leading-snug text-[var(--night-text-40)]">{it.why}</p>
                  )}
                </li>
              )
            })}
          </ul>

          {items.length < MAX_ITEMS && (
            <button
              onClick={add}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] text-sm text-[var(--night-text-40)] hover:text-[var(--night-text-70)]"
            >
              <IconPlus size={16} /> Добавить задание
            </button>
          )}

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
            {items.length > 0 ? `Выдать домашку · ${countable}` : 'Выдать домашку'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
