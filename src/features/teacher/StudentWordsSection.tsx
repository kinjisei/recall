// ============================================================================
// «Слова» ученика у преподавателя — ЕДИНСТВЕННОЕ место про его словарь:
// посмотреть со статусом изученности, выдать новые (готовые паки или свои
// наборы), удалить лишние, назначить перепроверку (макет d10-3, Ф2.17-4б-2):
// карточка «Отметь слова для перепроверки · 86 в колоде» с «+ Выдать слова»,
// список с галочками, внизу панели — «Выбрано 3 · уйдут Айгерим в
// приложение» и «Назначить перепроверку (3)»; прошлые перепроверки — ниже.
//
// Раньше выдача жила отдельным разделом «Наборы слов» и работала через
// колоду-копию учителя. Это давало разрыв: getStudentWords читает только колоды
// ученика, поэтому выданные слова не появлялись здесь и по ним нельзя было
// назначить перепроверку. Теперь слова кладутся в колоду ученика — и весь
// словарь виден в одном списке.
// ============================================================================
import { useState } from 'react'
import { firstName } from '../../domains/students'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { RevealLink } from '../../shared/ui/Disclosure'
import { LoadError } from '../../shared/ui/LoadError'
import { Reveal } from '../../shared/ui/Reveal'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { assignWordCheck, getStudentWords, getWordChecks, type StudentWord } from '../../lib/wordChecks'
import type { CardSource, CEFRLevel, WordCheck } from '../../types'
import { IconCheck, IconPlus, IconTrash } from '../../shared/ui/icons'
import { deleteStudentCards } from '../../lib/teacher'
import { WordPicker } from './WordPicker'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { InfoBox, SectionCard, SectionFooter } from './sectionBits'
import { ErrorText } from '../../shared/ui/ErrorText'

// подписи от 3-го лица — так их видит учитель
const STATUS_LABEL = { new: 'новое', learning: 'учится', learned: 'выучено' } as const

/**
 * Откуда слово. Без этого учитель удалял бы вслепую и мог стереть слово,
 * которое ученик добавил сам из чтения.
 */
const ORIGIN: Record<CardSource, string> = {
  teacher: 'от тебя',
  reader: 'из чтения',
  ai: 'из разбора AI',
  manual: 'добавлено учеником',
}

/** Сколько строк сразу: длинный словарь — по «Показать ещё». */
const FIRST = 40

export function StudentWordsSection({
  studentId,
  studentName,
  studentLevel,
}: {
  studentId: string
  /** Имя из карточки — «уйдут Айгерим в приложение». */
  studentName: string
  /** Уровень ученика: в шторке сразу раскрывается его секция паков. */
  studentLevel: CEFRLevel | null
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCheck, setOpenCheck] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [all, setAll] = useState(false)
  const { confirm, dialog } = useConfirm()

  // «Слов: 0» при сбое вводило преподавателя в заблуждение — теперь ошибка видна;
  // перечитывание (выдали, удалили, назначили) не стирает список с экрана
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const loaded = useAsyncData(() => getStudentWords(studentId), [studentId, version], 'Не удалось загрузить слова')
  const past = useAsyncData(() => getWordChecks(studentId).catch((): WordCheck[] => []), [studentId, version])
  const words = loaded.data
  const checks = past.data ?? []

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
    known.set(w.card.front.trim().toLowerCase(), STATUS_LABEL[w.status])
  }

  // Удаление предупреждает про ПРОГРЕСС: со словом уходит вся история
  // повторений, а если слово добавил ученик — это ещё и не твоя работа.
  const removeCard = async (w: StudentWord) => {
    const ok = await confirm({
      title: `Удалить «${w.card.front}»?`,
      body: `${w.card.source === 'teacher' ? 'Слово выдал ты.' : 'Слово добавил ученик сам.'} Вместе с ним пропадёт весь прогресс по нему. Отменить нельзя.`,
      action: 'Удалить',
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await deleteStudentCards(studentId, [w.card.id])
      setMsg(`Слово «${w.card.front}» удалено`)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(w.card.id)
        return next
      })
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
  if (loaded.error) return <LoadError message={loaded.error} onRetry={loaded.reload} />
  if (words === null) return <RowsSkeleton count={4} height={58} />

  const shown = all ? words : words.slice(0, FIRST)
  const n = selected.size

  return (
    <>
      <SectionCard
        title={words.length ? 'Отметь слова для перепроверки' : 'Слова'}
        note={`${words.length} в колоде`}
        action={
          <Button variant="outline" size="sm" onClick={() => setPicker(true)}>
            <IconPlus size={18} aria-hidden />
            Выдать слова
          </Button>
        }
      >
        {words.length === 0 ? (
          <InfoBox>Словарь пуст. Выдай слова из готового набора — они появятся здесь со статусом изученности.</InfoBox>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-line overflow-clip rounded-control inset-ring inset-ring-line">
              {shown.map((w) => (
                <WordRow key={w.card.id} w={w} on={selected.has(w.card.id)} onToggle={() => toggle(w.card.id)} onDelete={() => void removeCard(w)} />
              ))}
            </ul>
            {words.length > FIRST && (
              <RevealLink open={all} onToggle={() => setAll((v) => !v)} className="self-start">
                {all ? 'Свернуть' : `Показать ещё ${words.length - FIRST}`}
              </RevealLink>
            )}
          </>
        )}
        {msg && <p className="text-sm text-success-strong">{msg}</p>}
        {error && <ErrorText>{error}</ErrorText>}
      </SectionCard>

      {checks.length > 0 && (
        <SectionCard title="Перепроверки" note={`${checks.length}`}>
          <div className="flex flex-col divide-y divide-line">
            {checks.map((c) => {
              const okCount = (c.results ?? []).filter((r) => r.ok).length
              const wrong = (c.results ?? []).filter((r) => !r.ok)
              const date = new Date(c.created_at).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' })
              return (
                <div key={c.id} className="py-2 text-body">
                  {c.completed_at ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-fg-secondary">{date}</span>
                        <b className="font-semibold tabular-nums text-fg">
                          {okCount} из {c.card_ids.length}
                        </b>
                        {wrong.length > 0 && (
                          <RevealLink open={openCheck === c.id} onToggle={() => setOpenCheck((cur) => (cur === c.id ? null : c.id))}>
                            {openCheck === c.id ? 'Скрыть ошибки' : 'Показать ошибки'}
                          </RevealLink>
                        )}
                      </p>
                      <Reveal open={openCheck === c.id}>
                        {wrong.map((r) => (
                          <p key={r.card_id} className="mt-1 text-note text-fg-muted">
                            «{r.given || '—'}» → <span className="font-semibold text-fg-secondary">{r.front}</span>
                            {r.back && ` (${r.back})`}
                          </p>
                        ))}
                      </Reveal>
                    </>
                  ) : (
                    <p className="text-fg-muted">
                      {date}: назначена, ещё не пройдена · слов {c.card_ids.length}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {words.length > 0 && (
        <SectionFooter text={n ? `Выбрано ${n} · уйдут ${firstName(studentName)} в приложение` : 'Отметь слова, которые проверить'}>
          <Button onClick={() => void assign()} disabled={n === 0} loading={busy}>
            Назначить перепроверку ({n})
          </Button>
        </SectionFooter>
      )}

      {picker && (
        <WordPicker
          studentId={studentId}
          studentLevel={studentLevel}
          known={known}
          onClose={() => setPicker(false)}
          onAssigned={(added) => {
            setPicker(false)
            setMsg(added > 0 ? `Выдано слов: ${added} ✓` : 'Все эти слова у ученика уже есть — ничего не добавлено')
            reload()
          }}
        />
      )}
      {dialog}
    </>
  )
}

/** Строка слова (d10-3 `.wr`): галочка, «reluctant — неохотный», откуда · статус, корзина. */
function WordRow({ w, on, onToggle, onDelete }: { w: StudentWord; on: boolean; onToggle: () => void; onDelete: () => void }) {
  const status = `${STATUS_LABEL[w.status]}${w.status === 'learning' && w.intervalDays > 0 ? ` ${w.intervalDays}д` : ''}`
  return (
    <li className={`flex min-h-14.5 items-center gap-1.5 py-1.5 pl-3 pr-1.5 transition-colors ${on ? 'bg-accent-soft' : ''}`}>
      {/* галочка — родная, прозрачная во всю подпись: цель касания — строка, а не квадрат 22 */}
      <label className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch">
        <input type="checkbox" checked={on} onChange={onToggle} className="peer absolute inset-0 size-full cursor-pointer opacity-0" />
        <span
          aria-hidden
          className={`flex size-5.5 flex-none items-center justify-center rounded-tag peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
            on ? 'bg-primary text-primary-fg' : 'bg-surface inset-ring-2 inset-ring-fg-faint'
          }`}
        >
          {on && <IconCheck size={14} />}
        </span>
        <span className={`flex min-w-0 flex-col leading-snug ${on ? 'text-accent-soft-fg' : ''}`}>
          <span className="truncate text-base">
            <b lang={w.lang} className="font-semibold">
              {w.card.front}
            </b>
            {w.card.back && <span className={on ? '' : 'text-fg-secondary'}> — {w.card.back}</span>}
          </span>
          <small className={`truncate text-note ${on ? '' : 'text-fg-muted'}`}>
            {ORIGIN[w.card.source]} · {status}
          </small>
        </span>
      </label>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Удалить ${w.card.front}`}
        className="flex size-11 flex-none items-center justify-center rounded-control-sm text-fg-muted hover:text-danger-strong active:bg-ghost-press"
      >
        <IconTrash size={18} />
      </button>
    </li>
  )
}
