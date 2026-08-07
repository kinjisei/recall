// ============================================================================
// «Я пришёл как преподаватель» — метка из ссылки, пережившая поход в почту.
//
// Зачем: лендинг /teachers ведёт наш платящий сегмент, но кнопка отправляла на
// обычную регистрацию, и человек должен был потом САМ искать переключатель
// режима. Теперь ссылка несёт ?role=teacher, метка кладётся в localStorage и
// переживает подтверждение почты (оно открывается новой загрузкой страницы,
// состояние React к тому моменту потеряно).
// ============================================================================
const KEY = 'recall.pending_role'

/** Запомнить метку из ссылки вида /login?role=teacher. */
export function rememberPendingRole(search: string): void {
  try {
    const role = new URLSearchParams(search).get('role')
    if (role === 'teacher') localStorage.setItem(KEY, 'teacher')
  } catch {
    /* приватный режим — просто не запомним, путь через меню остаётся */
  }
}

export function hasPendingTeacherRole(): boolean {
  try {
    return localStorage.getItem(KEY) === 'teacher'
  } catch {
    return false
  }
}

export function clearPendingRole(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* не страшно: повторное включение роли идемпотентно */
  }
}
