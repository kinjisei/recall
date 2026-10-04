// ============================================================================
// «Я пришёл как преподаватель» — метка из ссылки, пережившая поход в почту.
//
// Зачем: лендинг /teachers ведёт наш платящий сегмент, но кнопка отправляла на
// обычную регистрацию, и человек должен был потом САМ искать переключатель
// режима. Теперь ссылка несёт ?role=teacher, метка кладётся в localStorage и
// переживает подтверждение почты (оно открывается новой загрузкой страницы,
// состояние React к тому моменту потеряно).
//
// Приглашение коллеги (PLAN.md Ф2.3) — та же ссылка с &ref=<личный код>:
// код живёт рядом с меткой и уходит в become_teacher при первом включении
// режима (база даёт +7 дней пробного). ref без role=teacher тоже значит
// «репетитор»: приглашают только репетиторов.
//
// Приглашение ученика (PLAN.md Ф2.5) — /login?join=<код карточки>: код ждёт
// здесь и подставляется в поле «Код преподавателя» на Главной и в конце
// онбординга. Привязывается ученик сам, кнопкой: без его согласия чужой
// учитель не увидит его прогресс.
// ============================================================================
import { parseRefCode } from '../domains/billing'
import { parseJoinCode } from '../domains/students'

const KEY = 'recall.pending_role'
const REF_KEY = 'recall.pending_ref'
const JOIN_KEY = 'recall.pending_join'

/** Запомнить метку из ссылки вида /login?role=teacher[&ref=MADINA7] или /login?join=K7M2PX. */
export function rememberPendingRole(search: string): void {
  try {
    const params = new URLSearchParams(search)
    const ref = parseRefCode(params.get('ref'))
    if (params.get('role') === 'teacher' || ref) localStorage.setItem(KEY, 'teacher')
    if (ref) localStorage.setItem(REF_KEY, ref)
    const join = parseJoinCode(params.get('join'))
    if (join) localStorage.setItem(JOIN_KEY, join)
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

/** Код пригласившего из ссылки; нет — null. */
export function pendingRef(): string | null {
  try {
    return parseRefCode(localStorage.getItem(REF_KEY))
  } catch {
    return null
  }
}

/** Есть ли в адресе приглашение коллеги — экрану входа, чтобы сказать о бонусе. */
export function refInSearch(search: string): boolean {
  try {
    return parseRefCode(new URLSearchParams(search).get('ref')) !== null
  } catch {
    return false
  }
}

export function clearPendingRole(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(REF_KEY)
  } catch {
    /* не страшно: повторное включение роли идемпотентно */
  }
}

/** Код приглашения ученика из ссылки; нет — null. */
export function pendingJoin(): string | null {
  try {
    return parseJoinCode(localStorage.getItem(JOIN_KEY))
  } catch {
    return null
  }
}

/** Есть ли в адресе приглашение ученика — экрану входа, чтобы сказать о нём. */
export function joinInSearch(search: string): boolean {
  try {
    return parseJoinCode(new URLSearchParams(search).get('join')) !== null
  } catch {
    return false
  }
}

/** Код использован (привязался или код не подошёл) — больше не подставлять. */
export function clearPendingJoin(): void {
  try {
    localStorage.removeItem(JOIN_KEY)
  } catch {
    /* приватный режим — код и не сохранялся */
  }
}
