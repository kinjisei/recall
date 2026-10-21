// ============================================================================
// Уровни учеников для мастера материала (PLAN.md Ф2.17-4в-2б): «Для кого» в
// заявке, «Уровень — под самого слабого — Әсел» в итоге и «Назначится при
// сохранении … B1» на шаге текста. Один запрос тестов на весь мастер — его
// держит MaterialsSection, шаги получают готовое. Правила — audience.ts.
// ============================================================================
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { listDonePlacements } from '../../../lib/placement'
import type { StudentInfo } from '../../../lib/teacher'
import type { AppLang, CEFRLevel } from '../../../types'
import { levelIn, type DoneTest, type Picked } from './audience'

export interface StudentLevels {
  nameOf: (id: string) => string
  /** Уровень в языке материала; null — не знаем (или тесты ещё не пришли). */
  levelOf: (id: string, lang: AppLang) => CEFRLevel | null
  /** Испанский уровень виден только по тестам: пока они не пришли — «не знаем» было бы неправдой. */
  known: (lang: AppLang) => boolean
  picked: (ids: string[], lang: AppLang) => Picked[]
  error: string | null
  reload: () => void
}

export function useStudentLevels(students: StudentInfo[]): StudentLevels {
  const ids = students.map((s) => s.profile.id)
  const tests = useAsyncData<DoneTest[]>(() => listDonePlacements(ids), [ids.join(',')], 'Уровни учеников не загрузились')
  const profileOf = (id: string) => students.find((s) => s.profile.id === id)?.profile
  const nameOf = (id: string) => profileOf(id)?.display_name || 'без имени'
  const levelOf = (id: string, lang: AppLang) => levelIn(lang, profileOf(id)?.level ?? null, tests.data ?? [], id)
  return {
    nameOf,
    levelOf,
    known: (lang) => lang === 'en' || !!tests.data,
    picked: (list, lang) => list.map((id) => ({ name: nameOf(id), level: levelOf(id, lang) })),
    error: tests.error,
    reload: tests.reload,
  }
}
