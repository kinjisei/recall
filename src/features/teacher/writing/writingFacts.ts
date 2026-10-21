// ============================================================================
// Подписи письменного задания у учителя (макет d9-1, PLAN.md Ф2.17-4в-3):
// строка вида в списке «IELTS · Task 2 · band 6.5», ярлык в подробностях
// «IELTS · Task 2 · эссе», плитки «Целевой балл · Объём · Время» и сводка
// выдач «1 сдано · 1 проверено · 1 назначено». Без экрана и базы — держит
// test-writing-facts. Названия типов IELTS — lib/writingLabels (одно место).
// ============================================================================
import { ieltsTaskLabel } from '../../../lib/writingLabels.ts'
import type { AppLang, WritingSettings, WritingTask, WritingTaskAssignment } from '../../../types'

type IeltsTask = NonNullable<WritingSettings['ieltsTask']>

/** Что пишет ученик в каждом типе IELTS — объём и время экзамена. */
export const IELTS_TYPES: Record<IeltsTask, { genre: string; words: number; minutes: number }> = {
  task2: { genre: 'эссе', words: 250, minutes: 40 },
  gt1: { genre: 'письмо', words: 150, minutes: 20 },
  academic1: { genre: 'описание графика', words: 150, minutes: 20 },
}

const LANG_SHORT: Record<AppLang, string> = { en: 'EN', es: 'ES' }
const LANG_NAME: Record<AppLang, string> = { en: 'английский', es: 'испанский' }

type TaskLike = Pick<WritingTask, 'mode' | 'level' | 'lang' | 'settings'>

const ieltsOf = (t: TaskLike): IeltsTask => t.settings?.ieltsTask ?? 'task2'

/** «6.0», а не «6»: балл хранится числом (в старых заданиях — строкой). */
export function bandText(b: number | string | null | undefined): string {
  const n = Number(b)
  return b == null || b === '' || !Number.isFinite(n) ? '' : n.toFixed(1)
}

/** «IELTS · Task 2 · band 6.5» / «Эссе · EN · B1» — строка вида в списке. */
export function kindLine(t: TaskLike): string {
  if (t.mode !== 'ielts') return `Эссе · ${LANG_SHORT[t.lang] ?? t.lang} · ${t.level}`
  const band = bandText(t.settings?.targetBand)
  return `IELTS · ${ieltsTaskLabel(ieltsOf(t))}${band ? ` · band ${band}` : ''}`
}

/** «IELTS · Task 2 · эссе» / «Эссе · английский · B1» — ярлык в подробностях. */
export function kindChip(t: TaskLike): string {
  if (t.mode !== 'ielts') return `Эссе · ${LANG_NAME[t.lang] ?? t.lang} · ${t.level}`
  return `IELTS · ${ieltsTaskLabel(ieltsOf(t))} · ${IELTS_TYPES[ieltsOf(t)].genre}`
}

/** «эссе · от 250 слов · 40 минут» — подпись типа в «Новом письме» (d9-2). */
export const ieltsHint = (k: IeltsTask): string => `${IELTS_TYPES[k].genre} · от ${IELTS_TYPES[k].words} слов · ${IELTS_TYPES[k].minutes} минут`

export interface Fact {
  label: string
  value: string
}

/** Плитки под вопросом (d9-1 `.set9`): IELTS — балл, объём, время; эссе — уровень, объём, язык. */
export function taskFacts(t: TaskLike): Fact[] {
  if (t.mode === 'ielts') {
    const k = IELTS_TYPES[ieltsOf(t)]
    return [
      { label: 'Целевой балл', value: bandText(t.settings?.targetBand) || '—' },
      { label: 'Объём', value: `от ${k.words} слов` },
      { label: 'Время', value: `${k.minutes} минут` },
    ]
  }
  const min = t.settings?.minWords
  return [
    { label: 'Уровень', value: t.level },
    { label: 'Объём', value: min ? `от ${min} слов` : 'любой' },
    { label: 'Язык', value: LANG_NAME[t.lang] ?? t.lang },
  ]
}

export interface Tally {
  submitted: number
  reviewed: number
  assigned: number
}

export function tally(list: Pick<WritingTaskAssignment, 'status'>[]): Tally {
  const out: Tally = { submitted: 0, reviewed: 0, assigned: 0 }
  for (const a of list) out[a.status] += 1
  return out
}

/** «1 сдано · 1 проверено · 1 назначено» — без нулей; никому — «не назначено». */
export function tallyLine(t: Tally): string {
  const parts = [t.submitted && `${t.submitted} сдано`, t.reviewed && `${t.reviewed} проверено`, t.assigned && `${t.assigned} назначено`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'не назначено'
}
