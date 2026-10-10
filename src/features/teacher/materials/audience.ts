// ============================================================================
// «Для кого» в заявке на материал (PLAN.md Ф2.11б-3, журнал п.71 (10)):
// несколько учеников или группа из расписания — и это же назначение.
// Здесь только правила, без базы и экранов, — их держит test-material-audience.
//
// Уровень — самого слабого из выбранных: текст выше уровня слабый не
// прочтёт, сильный простой прочтёт. Разные уровни — строка-предупреждение.
// ============================================================================
import { CEFR } from '../../../lib/cefr.ts'
import type { AppLang, CEFRLevel } from '../../../types'

/** Пройденный тест уровня (строка placement_requests). */
export interface DoneTest {
  student_id: string
  lang: AppLang
  result_level: CEFRLevel | null
  completed_at: string | null
}

/**
 * Уровень ученика в языке материала. Английский — из профиля: его пишет и
 * онбординг, и любой тест уровня. Испанский профиль не хранит (он на телефоне
 * ученика, lib/level) — учителю виден только тест, который он назначал.
 */
export function levelIn(lang: AppLang, profileLevel: CEFRLevel | null, tests: DoneTest[], studentId: string): CEFRLevel | null {
  if (lang === 'en') return profileLevel
  const last = tests
    .filter((t) => t.student_id === studentId && t.lang === lang && t.result_level)
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]
  return last?.result_level ?? null
}

/** Самый низкий из известных уровней; null — ни одного не знаем. */
export function weakest(levels: (CEFRLevel | null)[]): CEFRLevel | null {
  const idx = levels.map((l) => (l ? CEFR.indexOf(l) : -1)).filter((i) => i >= 0)
  return idx.length ? (CEFR[Math.min(...idx)] as CEFRLevel) : null
}

export interface Picked {
  name: string
  level: CEFRLevel | null
}

/**
 * Строка-предупреждение под выбором: уровни разные — под кого текст; уровень
 * формы выше чьего-то — кому будет трудно (учитель поднял его руками); чей
 * уровень неизвестен — где его узнать. Пусто — предупреждать не о чем.
 */
export function levelNote(picked: Picked[], chosen: CEFRLevel): string {
  // от слабого к сильному: первым видно того, под кого текст
  const known = picked.filter((p) => p.level).sort((a, b) => CEFR.indexOf(a.level!) - CEFR.indexOf(b.level!))
  const unknown = picked.filter((p) => !p.level).map((p) => p.name)
  const below = known.filter((p) => CEFR.indexOf(p.level!) < CEFR.indexOf(chosen)).map((p) => p.name)
  const notes: string[] = []
  const mixed = new Set(known.map((p) => p.level)).size > 1
  if (mixed) notes.push(`Уровни разные: ${known.map((p) => `${p.name} ${p.level}`).join(' · ')}.`)
  if (below.length) notes.push(`Текст ${chosen} будет трудным для: ${below.join(', ')}.`)
  else if (mixed && chosen === weakest(known.map((p) => p.level))) notes.push(`Текст — под самого слабого (${chosen}).`)
  if (unknown.length) notes.push(`Уровень не знаем: ${unknown.join(', ')} — тест уровня в карточке ученика.`)
  return notes.join(' ')
}

/** Серия расписания и карточка ученика — только то, что нужно группам. */
export interface GroupSeries {
  id: string
  kind: string
  title: string | null
  cardIds: string[]
}
export interface GroupCard {
  id: string
  userId: string | null
  name: string
  status: string
}

export interface ScheduleGroup {
  id: string
  label: string
  /** Ученики группы в приложении — им материал и назначится. */
  ids: string[]
  /** Кто из группы ещё не в приложении (имена): назначить им нельзя. */
  outside: string[]
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name

/**
 * Группы из расписания: групповые серии с учениками в приложении. Две серии
 * одного состава (вторник и четверг отдельно) — одна группа. Архив не берём:
 * ученик ушёл, а серия могла остаться.
 */
export function scheduleGroups(series: GroupSeries[], cards: GroupCard[], inApp: string[]): ScheduleGroup[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const known = new Set(inApp)
  const seen = new Set<string>()
  const out: ScheduleGroup[] = []
  for (const s of series) {
    if (s.kind !== 'group') continue
    const members = s.cardIds.map((id) => byId.get(id)).filter((c): c is GroupCard => !!c && c.status !== 'archived')
    const ids = [...new Set(members.flatMap((c) => (c.userId && known.has(c.userId) ? [c.userId] : [])))].sort()
    const key = ids.join(',')
    if (ids.length === 0 || seen.has(key)) continue
    seen.add(key)
    const outside = members.filter((c) => !c.userId || !known.has(c.userId)).map((c) => first(c.name))
    const label = s.title?.trim() ? `Группа «${s.title.trim()}»` : `Группа: ${members.map((c) => first(c.name)).join(', ')}`
    out.push({ id: s.id, label, ids, outside })
  }
  return out
}

/** Нажали на ученика: отметить или снять. */
export const toggleOne = (picked: string[], id: string): string[] =>
  picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]

/** Нажали на группу: все уже отмечены — снять группу, иначе отметить всех. */
export function toggleGroup(picked: string[], ids: string[]): string[] {
  const all = ids.every((id) => picked.includes(id))
  return all ? picked.filter((x) => !ids.includes(x)) : [...picked, ...ids.filter((id) => !picked.includes(id))]
}

/** Отмеченные в черновике заявки; черновик до Ф2.11б-3 хранил одного (studentId). */
export function pickedIds(form: { studentIds?: unknown; studentId?: unknown }): string[] {
  if (Array.isArray(form.studentIds)) return form.studentIds.filter((x): x is string => typeof x === 'string')
  return typeof form.studentId === 'string' ? [form.studentId] : []
}

/** Имена для строки «Назначится: …»: больше трёх — «и ещё N». */
export function namesLine(names: string[]): string {
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')} и ещё ${names.length - 3}`
}
