// ============================================================================
// Описание: src/features/writing/CLAUDE.md
// Как называть письменное задание — одно место на экраны ученика и
// преподавателя (хаб «Заданий», проверка, «Письменные задания», диагностика,
// «Письмо» ученика). Было пять копий, и четыре называли Academic Task 1
// (график) «Task 2» (Ф2.17-4в-1).
// ============================================================================
import type { WritingSettings, WritingTask } from '../types'

/** «Task 2» · «GT Task 1» · «Academic Task 1». */
export function ieltsTaskLabel(t: WritingSettings['ieltsTask'] | undefined): string {
  return t === 'gt1' ? 'GT Task 1' : t === 'academic1' ? 'Academic Task 1' : 'Task 2'
}

/** «IELTS Task 2» / «Эссе B1» — вид задания (заголовок проверки, d7-3). */
export function writingKind(task: Pick<WritingTask, 'mode' | 'level' | 'settings'>): string {
  return task.mode === 'ielts' ? `IELTS ${ieltsTaskLabel(task.settings?.ieltsTask)}` : `Эссе ${task.level}`
}

/** «Письмо IELTS Task 2» / «Эссе B1» — строка в списке работ (хаб d7-1, диагностика d10-2). */
export function writingName(task: Pick<WritingTask, 'mode' | 'level' | 'settings'>): string {
  return task.mode === 'ielts' ? `Письмо ${writingKind(task)}` : writingKind(task)
}
