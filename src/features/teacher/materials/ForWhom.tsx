// «Для кого» в заявке на материал (PLAN.md Ф2.11б-3): несколько учеников или
// группа из расписания — и это же назначение. Правила — audience.ts.
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { loadMySeries } from '../../../domains/schedule'
import { loadStudentCards } from '../../../domains/students'
import { listDonePlacements } from '../../../lib/placement'
import type { StudentInfo } from '../../../lib/teacher'
import type { AppLang, CEFRLevel } from '../../../types'
import { levelIn, levelNote, scheduleGroups, toggleGroup, toggleOne, weakest, type DoneTest } from './audience'
import { chip } from './shared'

export function ForWhom({
  students,
  lang,
  level,
  own,
  picked,
  onPick,
}: {
  students: StudentInfo[]
  /** Язык материала: уровень ученика — в нём. */
  lang: AppLang
  /** Уровень в форме — предупредить, если он выше чьего-то. */
  level: CEFRLevel
  /** «Мой текст»: диагностику AI не получает, выбор — только назначение. */
  own: boolean
  picked: string[]
  /** Новый выбор и уровень самого слабого из него (null — ничей не знаем). */
  onPick: (ids: string[], level: CEFRLevel | null) => void
}) {
  const allIds = students.map((s) => s.profile.id)
  const key = allIds.join(',')
  // уровень испанского учителю виден только по тесту, который он назначал
  const tests = useAsyncData<DoneTest[]>(() => listDonePlacements(allIds), [key], 'Уровни учеников не загрузились')
  const groups = useAsyncData(
    async () => {
      const [series, cards] = await Promise.all([loadMySeries(), loadStudentCards()])
      return scheduleGroups(series, cards, allIds)
    },
    [key],
    'Группы из расписания не загрузились',
  )
  const levelOf = (id: string) =>
    levelIn(lang, students.find((s) => s.profile.id === id)?.profile.level ?? null, tests.data ?? [], id)
  const nameOf = (id: string) => students.find((s) => s.profile.id === id)?.profile.display_name || 'без имени'
  const pick = (ids: string[]) => onPick(ids, weakest(ids.map(levelOf)))

  // пока тесты не пришли (или не загрузились), про испанский уровень молчим: «не знаем» было бы неправдой
  const testsNeeded = lang !== 'en'
  const note = testsNeeded && !tests.data ? '' : levelNote(picked.map((id) => ({ name: nameOf(id), level: levelOf(id) })), level)
  const outside = (groups.data ?? [])
    .filter((g) => g.outside.length && g.ids.every((id) => picked.includes(id)))
    .flatMap((g) => g.outside)
  const failed = (testsNeeded && tests.error) || groups.error
  const hint =
    picked.length === 0
      ? 'Никто не отмечен — материал общий, назначить можно потом.'
      : own
        ? 'Материал назначится выбранным при сохранении.'
        : picked.length === 1
          ? 'AI учтёт слова и темы, где этот ученик ошибается. Материал назначится при сохранении.'
          : 'AI учтёт общие слабые места выбранных. Материал назначится всем при сохранении.'

  return (
    <div data-for-whom>
      <p className="mb-1 text-xs font-semibold text-fg-muted">Для кого</p>
      <div className="flex flex-wrap gap-2">
        <button className={chip(picked.length === 0)} onClick={() => pick([])}>
          Общий материал
        </button>
        {(groups.data ?? []).map((g) => (
          <button
            key={g.id}
            className={chip(g.ids.every((id) => picked.includes(id)))}
            onClick={() => pick(toggleGroup(picked, g.ids))}
          >
            {g.label}
          </button>
        ))}
        {students.map((st) => (
          <button
            key={st.profile.id}
            className={chip(picked.includes(st.profile.id))}
            aria-pressed={picked.includes(st.profile.id)}
            onClick={() => pick(toggleOne(picked, st.profile.id))}
          >
            {st.profile.display_name || 'без имени'}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-fg-muted">{hint}</p>
      {note && <p className="mt-1 text-xs text-warning-soft-fg">{note}</p>}
      {outside.length > 0 && (
        <p className="mt-1 text-xs text-fg-muted">Ещё не в приложении: {outside.join(', ')} — им не назначится.</p>
      )}
      {failed && (
        <button
          className="mt-1 text-xs font-semibold text-accent-strong"
          onClick={() => (testsNeeded && tests.error ? tests.reload() : groups.reload())}
        >
          {failed} · Повторить
        </button>
      )}
    </div>
  )
}
