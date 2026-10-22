// ============================================================================
// «Выгрузить мои данные» без базы (PLAN.md Ф2.17-4г-2б): какие части есть в
// выгрузке, как они названы по-русски и как из ответа export_my_data()
// собирается файл. Проверяется в node: scripts/test-account-export.mjs.
//
// Список частей — пара к функции export_my_data (миграция 0016): тест сверяет,
// что ключи совпадают. Часть, которую база вернула, а здесь её нет, всё равно
// попадает в файл (в конец, без подписи): выгрузка ничего не теряет, даже если
// сервер обновили раньше приложения.
// ============================================================================
import { almatyDay } from '../../shared/lib/almaty.ts'

/**
 * Отметка в sessionStorage «аккаунт только что удалён»: Настройки ставят её
 * перед выходом, экран входа один раз показывает «Аккаунт удалён» и стирает.
 * sessionStorage, а не localStorage: выход стирает recall.* в localStorage.
 */
export const ACCOUNT_DELETED_KEY = 'recall.accountDeleted'

/** Части выгрузки по порядку — сначала учёба, потом студия, оплаты, уведомления. */
export const EXPORT_PARTS: readonly { key: string; what: string }[] = [
  { key: 'activity_log', what: 'дни занятий: что и сколько' },
  { key: 'decks', what: 'колоды слов' },
  { key: 'cards', what: 'слова' },
  { key: 'review_states', what: 'повторение слов: когда и как отвечено' },
  { key: 'deck_assignments', what: 'колоды от преподавателя' },
  { key: 'conversations', what: 'диалоги с AI' },
  { key: 'messages', what: 'сообщения диалогов' },
  { key: 'grammar_mistakes', what: 'ошибки в грамматике' },
  { key: 'writing_submissions', what: 'письменные работы' },
  { key: 'writing_task_assignments', what: 'письменные задания' },
  { key: 'material_assignments', what: 'задания по материалам' },
  { key: 'material_replans', what: 'пересборки материалов' },
  { key: 'placement_requests', what: 'тесты уровня' },
  { key: 'grammar_quests', what: 'AI-квесты' },
  { key: 'homework', what: 'домашка' },
  { key: 'homework_items', what: 'пункты домашки' },
  { key: 'study_plans', what: 'программы обучения' },
  { key: 'study_plan_marks', what: 'отмеченные пункты программы' },
  { key: 'word_checks', what: 'проверки слов' },
  { key: 'teacher_students', what: 'связь ученик — преподаватель' },
  { key: 'student_cards', what: 'карточки учеников' },
  { key: 'lessons', what: 'уроки' },
  { key: 'lesson_participants', what: 'кто был на уроках' },
  { key: 'lesson_series', what: 'повторяющиеся уроки' },
  { key: 'series_participants', what: 'ученики повторяющихся уроков' },
  { key: 'paid_lessons', what: 'оплаченные уроки' },
  { key: 'schedule_settings', what: 'настройки расписания' },
  { key: 'materials', what: 'материалы' },
  { key: 'writing_tasks', what: 'письменные задания студии' },
  { key: 'teacher_signups', what: 'ответы при регистрации репетитора' },
  { key: 'payments', what: 'оплаты тарифа' },
  { key: 'payment_claims', what: 'заявки «Оплата отправлена»' },
  { key: 'personal_codes', what: 'код для перевода' },
  { key: 'referrals', what: 'приглашённые коллеги' },
  { key: 'notifications', what: 'уведомления' },
  { key: 'notification_prefs', what: 'настройки уведомлений' },
]

/** Файл выгрузки: имя и текст JSON. */
export function exportFile(
  data: Record<string, unknown>,
  email: string | null,
  now: Date = new Date(),
): { name: string; text: string } {
  const day = almatyDay(now)
  const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const parts: Record<string, { what: string; rows: unknown[] }> = {}
  for (const p of EXPORT_PARTS) parts[p.key] = { what: p.what, rows: rows(data[p.key]) }
  for (const [key, v] of Object.entries(data)) {
    if (key !== 'profile' && !(key in parts)) parts[key] = { what: '', rows: rows(v) }
  }
  const file = {
    about: `Выгрузка Recall от ${day}: всё, что есть в аккаунте. Части — таблицы базы, строки — как они хранятся.`,
    exported_at: now.toISOString(),
    account: { email },
    profile: data.profile ?? null,
    parts,
  }
  return { name: `recall-${day}.json`, text: JSON.stringify(file, null, 2) }
}
