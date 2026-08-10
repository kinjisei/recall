// ============================================================================
// «Слова» ученика у преподавателя — ЕДИНСТВЕННОЕ место про его словарь:
// посмотреть со статусом изученности, выдать новые (готовые паки или свои
// наборы), удалить лишние, назначить перепроверку.
//
// Раньше выдача жила отдельным разделом «Наборы слов» и работала через
// колоду-копию учителя. Это давало разрыв: getStudentWords читает только колоды
// ученика, поэтому выданные слова не появлялись здесь и по ним нельзя было
// назначить перепроверку. Теперь слова кладутся в колоду ученика — и весь
// словарь виден в одном списке.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import {
  assignWordCheck,
  getStudentWords,
  getWordChecks,
  WORD_STATUS_CLS,
  type StudentWord,
} from '../../lib/wordChecks'
import type { CEFRLevel, WordCheck } from '../../types'
import { IconTrash } from '../../components/icons'
import { deleteStudentCards } from '../../lib/teacher'
import { WordPicker } from './WordPicker'
import { RowsSkeleton } from '../../components/Loading'

// цвета — общий WORD_STATUS_CLS (тот же, что видит ученик); подписи от 3-го лица
const statusChip = {
  new: { label: 'новое', cls: WORD_STATUS_CLS.new },
  learning: { label: 'учится', cls: WORD_STATUS_CLS.learning },
  learned: { label: 'изучено', cls: WORD_STATUS_CLS.learned },
} as const

export function StudentWordsSection({
  studentId,
  studentLevel,
}: {
  studentId: string
  /** Уровень ученика: в шторке сразу раскрывается его секция паков. */
  studentLevel: CEFRLevel | null
}) {
  const [words, setWords] = useState<StudentWord[] | null>(null)
  const [checks, setChecks] = useState<WordCheck[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCheck, setOpenCheck] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  /** Подтверждение удаления: держим карточку, а не просто флаг — в тексте
   *  предупреждения нужно и слово, и его происхождение. */
  const [toDelete, setToDelete] = useState<StudentWord | null>(null)

  // «Слов: 0» при сбое вводило преподавателя в заблуждение — теперь ошибка видна
  const reload = useCallback(() => {
    setLoadError(null)
    getStudentWords(studentId)
      .then(setWords)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить слова'))
    getWordChecks(studentId)
      .then(setChecks)
      .catch(() => setChecks([]))
  }, [studentId])

  useEffect(() => {
    reload()
  }, [reload])

  const toggle = (cardId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })

  // Слова, которые ученик уже учит: шторка выдачи показывает их снятыми и с
  // подписью «уже учит · статус». Ключ — то же нормализованное слово, по
  // которому сервер отсеивает дубли.
  const known = new Map<string, string>()
  for (const w of words ?? []) {
    known.set(w.card.front.trim().toLowerCase(), statusChip[w.status].label)
  }

  const removeCard = async (w: StudentWord) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await deleteStudentCards(studentId, [w.card.id])
      setMsg(`Слово «${w.card.front}» удалено`)
      setToDelete(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
    } finally {
      setBusy(false)
    }
  }

  const assign = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await assignWordCheck(studentId, [...selected])
      setMsg(`Перепроверка назначена: слов — ${selected.size} ✓`)
      setSelected(new Set())
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось назначить')
    } finally {
      setBusy(false)
    }
  }

  // ошибка загрузки — отдельно от «слов нет»: иначе преподаватель видел бы
  // пустой список у ученика, у которого слова есть
  if (loadError) return <LoadError message={loadError} onRetry={reload} />
  if (words === null) return <RowsSkeleton count={3} height={44} />

  return (
    <div className="flex flex-col gap-2">
      {/* Прошлые перепроверки */}
      {checks.length > 0 && (
        <div className="flex flex-col gap-1">
          {checks.map((c) => {
            const okCount = (c.results ?? []).filter((r) => r.ok).length
            const wrong = (c.results ?? []).filter((r) => !r.ok)
            const date = new Date(c.created_at).toLocaleDateString('ru-RU')
            return (
              <div key={c.id} className="rounded-lg bg-[var(--night-surface)] px-3 py-2 text-sm">
                {c.completed_at ? (
                  <>
                    <button
                      onClick={() => setOpenCheck((cur) => (cur === c.id ? null : c.id))}
                      className="w-full text-left"
                    >
                      {date}:{' '}
                      <span className="font-semibold">
                        {okCount}/{c.card_ids.length}
                      </span>
                      {wrong.length > 0 && (
                        <span className="text-[var(--night-text-40)]"> · показать провалы {openCheck === c.id ? '▾' : '▸'}</span>
                      )}
                    </button>
                    {openCheck === c.id &&
                      wrong.map((r) => (
                        <p key={r.card_id} className="mt-1 pl-4 text-xs text-[var(--night-text-40)]">
                          «{r.given || '—'}» →{' '}
                          <span className="font-semibold text-[var(--night-text-70)]">
                            {r.front}
                          </span>
                          {r.back && ` (${r.back})`}
                        </p>
                      ))}
                  </>
                ) : (
                  <span className="text-[var(--night-text-40)]">
                    {date}: назначена, ещё не пройдена ({c.card_ids.length} слов)
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Button variant="secondary" className="self-start" onClick={() => setPicker(true)}>
        + Выдать слова
      </Button>

      {words.length === 0 ? (
        <p className="text-sm text-[var(--night-text-40)]">
          Словарь пуст. Выдай слова из готового набора — они появятся здесь со
          статусом изученности.
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--night-text-40)]">
            Отметь слова для перепроверки (сверху — с самым большим интервалом):
          </p>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {words.map((w) => {
              const chip = statusChip[w.status]
              return (
                <label
                  key={w.card.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(w.card.id)}
                    onChange={() => toggle(w.card.id)}
                    className="h-4 w-4 accent-sky-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{w.card.front}</span>
                    {w.card.back && <span className="text-[var(--night-text-40)]"> — {w.card.back}</span>}
                  </span>
                  {/* Происхождение: без него учитель удалял бы вслепую и мог
                      стереть слово, которое ученик добавил сам из чтения. */}
                  <span className="shrink-0 text-[11px] text-[var(--night-text-40)]">
                    {w.card.source === 'teacher' ? 'выдал я' : 'ученик'}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>
                    {chip.label}
                    {w.intervalDays > 0 ? ` ${w.intervalDays}д` : ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setToDelete(w)
                    }}
                    aria-label={`Удалить ${w.card.front}`}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--night-text-40)] hover:text-red-400"
                  >
                    <IconTrash size={16} />
                  </button>
                </label>
              )
            })}
          </div>
          <Button
            className="mt-1"
            onClick={assign}
            disabled={busy || selected.size === 0}
          >
            {busy ? 'Назначаю…' : `Назначить перепроверку (${selected.size})`}
          </Button>
        </>
      )}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Удаление предупреждает про ПРОГРЕСС: со словом уходит вся история
          повторений, а если слово добавил ученик — это ещё и не твоя работа. */}
      {toDelete && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.07] p-3 text-sm">
          <p>
            Удалить «{toDelete.card.front}»?{' '}
            <span className="text-[var(--night-text-40)]">
              {toDelete.card.source === 'teacher'
                ? 'Слово выдал ты.'
                : 'Слово добавил ученик сам.'}{' '}
              Вместе с ним пропадёт весь прогресс по нему. Отменить нельзя.
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="danger"
              className="px-3 py-1.5 text-sm"
              loading={busy}
              onClick={() => void removeCard(toDelete)}
            >
              Удалить
            </Button>
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-sm"
              onClick={() => setToDelete(null)}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {picker && (
        <WordPicker
          studentId={studentId}
          studentLevel={studentLevel}
          known={known}
          onClose={() => setPicker(false)}
          onAssigned={(added) => {
            setPicker(false)
            setMsg(
              added > 0
                ? `Выдано слов: ${added} ✓`
                : 'Все эти слова у ученика уже есть — ничего не добавлено',
            )
            reload()
          }}
        />
      )}
    </div>
  )
}
