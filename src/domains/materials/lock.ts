// ============================================================================
// Замок сданного материала (PLAN.md Ф2.25-3б, макет d17-4, журнал п.76 (21)).
//
// Материал, по которому работу уже сдали (ждёт проверки или проверена) или
// сдавали раньше (после «Переназначить» прошлая попытка — в истории),
// правится только копией: правка изменила бы проверку сданного. Держит база
// (триггер `materials_guard`, миграция 0018) — здесь то же правило для
// экрана: плашка вместо «Изменить · Убрать». Случаи общие с базой —
// `scripts/check-material-lock.mjs`.
// ============================================================================

/** Что о выдаче нужно правилу: статус и история попыток. */
export interface LockRow {
  status: string
  attempts?: readonly unknown[] | null
}

/** Эта выдача закрывает правку: сдана сейчас или сдавалась раньше. */
export function locksMaterial(a: LockRow): boolean {
  return a.status !== 'assigned' || (Array.isArray(a.attempts) && a.attempts.length > 0)
}

export interface EditLock<T> {
  locked: boolean
  /** Чьи работы закрывают правку. */
  by: T[]
  /** Все они — только в истории (переназначены и ещё не сданы снова). */
  onlyPast: boolean
}

export function editLock<T extends LockRow>(rows: readonly T[]): EditLock<T> {
  const by = rows.filter(locksMaterial)
  return { locked: by.length > 0, by, onlyPast: by.length > 0 && by.every((a) => a.status === 'assigned') }
}

/** «Әсел», «Әсел и Айгерим», «Әсел, Айгерим и ещё 2» — имена без падежей (журнал п.68). */
export function namesList(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' и ')
  return `${names.slice(0, 2).join(', ')} и ещё ${names.length - 2}`
}

/**
 * Плашка d17-4. В кадре — «Әсел уже сдала эту работу»; у нас слова без рода
 * и имя в начальной форме (журнал п.68, PLAN.md Ф2.17-4 «Осознанные
 * отличия»): «сдала» говорит о человеке то, чего мы не знаем.
 */
export function lockText(names: readonly string[], onlyPast: boolean): string {
  return `${onlyPast ? 'Работу уже сдавали' : 'Работу уже сдали'}: ${namesList(names)} — правка изменила бы её проверку`
}
