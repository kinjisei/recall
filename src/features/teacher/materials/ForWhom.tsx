// ============================================================================
// «Для кого» в заявке на материал (макет d8-2; PLAN.md Ф2.11б-3, Ф2.17-4в-2б):
// «Общий материал / Ученикам», выбранные — чипами «(АН) Айгерим Нурланова B1 ×»,
// «+ Ученик» — меню: группы из расписания и ученики. Это же назначение:
// «Сохранить» выдаст материал выбранным. Правила (уровень самого слабого,
// группы, предупреждение) — audience.ts.
// ============================================================================
import { useState } from 'react'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { loadMySeries } from '../../../domains/schedule'
import { loadStudentCards } from '../../../domains/students'
import type { StudentInfo } from '../../../lib/teacher'
import type { AppLang, CEFRLevel } from '../../../types'
import { Avatar } from '../../../shared/ui/Avatar'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import { IconClose, IconPlus, IconUsers } from '../../../shared/ui/icons'
import { MenuItem, MenuPanel, useMenu } from '../../../shared/ui/Menu'
import { levelNote, scheduleGroups, toggleGroup, toggleOne, weakest } from './audience'
import type { StudentLevels } from './useStudentLevels'
import { FieldLabel, Hint } from './wizardBits'

export function ForWhom({
  students,
  lang,
  level,
  own,
  picked,
  levels,
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
  /** Уровни учеников — один запрос на весь мастер (MaterialsSection). */
  levels: StudentLevels
  /** Новый выбор и уровень самого слабого из него (null — ничей не знаем). */
  onPick: (ids: string[], level: CEFRLevel | null) => void
}) {
  const allIds = students.map((s) => s.profile.id)
  const key = allIds.join(',')
  const groups = useAsyncData(
    async () => {
      const [series, cards] = await Promise.all([loadMySeries(), loadStudentCards()])
      return scheduleGroups(series, cards, allIds)
    },
    [key],
    'Группы из расписания не загрузились',
  )
  // «Ученикам» без выбранных — ещё не «общий»: учитель как раз выбирает
  const [some, setSome] = useState(picked.length > 0)
  const { open, leaving, close, trigger, box } = useMenu()
  const levelOf = (id: string) => levels.levelOf(id, lang)
  const nameOf = levels.nameOf
  const pick = (ids: string[]) => onPick(ids, weakest(ids.map(levelOf)))

  // пока тесты не пришли (или не загрузились), про испанский уровень молчим: «не знаем» было бы неправдой
  const note = levels.known(lang) ? levelNote(levels.picked(picked, lang), level) : ''
  const outside = (groups.data ?? []).filter((g) => g.outside.length && g.ids.every((id) => picked.includes(id))).flatMap((g) => g.outside)
  const testsFailed = lang !== 'en' && levels.error
  const failed = testsFailed || groups.error
  const freeGroups = (groups.data ?? []).filter((g) => !g.ids.every((id) => picked.includes(id)))
  const freeStudents = students.filter((s) => !picked.includes(s.profile.id))
  const hint = own || picked.length < 2 ? 'Материал назначится при сохранении' : 'Материал назначится всем при сохранении'

  return (
    <div data-for-whom>
      <FieldLabel>Для кого</FieldLabel>
      <div className="flex flex-col gap-2">
        <ChoiceGroup
          variant="segment"
          label="Для кого"
          value={some ? 'some' : 'all'}
          options={[
            { id: 'all', label: 'Общий материал' },
            { id: 'some', label: 'Ученикам' },
          ]}
          onChange={(v) => {
            setSome(v === 'some')
            if (v === 'all') pick([])
          }}
        />
        {some && (
          <div className="flex flex-wrap items-center gap-2 rounded-control-sm bg-input p-2">
            {picked.map((id) => {
              const lv = levelOf(id)
              return (
                <span key={id} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface pl-1.5 text-sm font-medium text-fg shadow-segment">
                  <Avatar name={nameOf(id)} size={28} />
                  {nameOf(id)}
                  {lv && <span className="rounded-full bg-input px-1.5 py-px text-xs font-semibold text-fg-secondary">{lv}</span>}
                  <button
                    type="button"
                    aria-label={`Убрать ${nameOf(id)}`}
                    onClick={() => pick(toggleOne(picked, id))}
                    className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:text-fg"
                  >
                    <IconClose size={16} aria-hidden />
                  </button>
                </span>
              )
            })}
            {(freeStudents.length > 0 || freeGroups.length > 0) && (
              <div ref={box} className="relative">
                <button type="button" {...trigger} className="inline-flex min-h-11 items-center gap-1 rounded-full pl-2 pr-3 text-sm font-medium text-accent-soft-fg active:bg-ghost-press">
                  <IconPlus size={16} aria-hidden /> Ученик
                </button>
                {open && (
                  <MenuPanel leaving={leaving} title="Кому выдать" className="left-0 top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto">
                    {freeGroups.map((g) => (
                      <MenuItem key={g.id} Icon={IconUsers} onSelect={() => {
                          pick(toggleGroup(picked, g.ids))
                          close()
                        }}>
                        {g.label}
                      </MenuItem>
                    ))}
                    {freeStudents.map((s) => (
                      <MenuItem key={s.profile.id} onSelect={() => {
                          pick(toggleOne(picked, s.profile.id))
                          close()
                        }}>
                        {s.profile.display_name || 'без имени'}
                      </MenuItem>
                    ))}
                  </MenuPanel>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {some && picked.length > 0 && <Hint>{hint}</Hint>}
      {note && <Hint warn>{note}</Hint>}
      {outside.length > 0 && <Hint>Ещё не в приложении: {outside.join(', ')} — им не назначится.</Hint>}
      {failed && (
        <button
          type="button"
          className="mx-1 mt-1 min-h-11 text-sm font-semibold text-accent-strong"
          onClick={() => (testsFailed ? levels.reload() : groups.reload())}
        >
          {failed} · Повторить
        </button>
      )}
    </div>
  )
}
