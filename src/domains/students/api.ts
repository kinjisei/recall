// ============================================================================
// Карточки учеников — единственное место, где домен ходит в базу (архитектура
// §2, §4). Таблица student_cards закрыта всем; всё — через RPC миграции 0008.
// Права и тариф проверяет база: без тарифа после пробного создание, правка и
// смена статуса отказывают (RECALL_PLAN_REQUIRED, журнал п.41).
// ============================================================================
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import type { CardStatus, StudentCard } from './model'

/** Все карточки учителя, в порядке создания (сортирует экран). */
export async function loadStudentCards(): Promise<StudentCard[]> {
  const { data, error } = await supabase.rpc('get_my_student_cards')
  if (error) throw dbError(error, 'загрузить учеников')
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id ?? null,
    name: r.name,
    contact: r.contact ?? null,
    note: r.note ?? null,
    status: r.status as CardStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    inApp: r.in_app === true,
    linkedAt: r.linked_at ?? null,
    seat: r.seat === true,
    holdsSeat: r.holds_seat === true,
  }))
}

export interface CardInput {
  name: string
  contact: string
  note: string
}

/** Новый ученик (макет t6-3): «пробный» или «занимается». Возвращает id. */
export async function createStudentCard(input: CardInput & { status: 'trial' | 'active' }): Promise<string> {
  const { data, error } = await supabase.rpc('create_student_card', {
    p_name: input.name,
    p_contact: input.contact,
    p_note: input.note,
    p_status: input.status,
  })
  if (error) throw dbError(error, 'добавить ученика')
  return data
}

/** «Изменить данные»: имя, контакт, заметка. */
export async function updateStudentCard(id: string, input: CardInput): Promise<void> {
  const { error } = await supabase.rpc('update_student_card', {
    p_card: id,
    p_name: input.name,
    p_contact: input.contact,
    p_note: input.note,
  })
  if (error) throw dbError(error, 'сохранить карточку')
}

/** Пауза, архив, возврат, «пробный → занимается». Места двигает база. */
export async function setCardStatus(id: string, status: CardStatus): Promise<void> {
  const { error } = await supabase.rpc('set_student_card_status', { p_card: id, p_status: status })
  if (error) throw dbError(error, 'поменять статус')
}

/** Код приглашения карточки (создаётся при первом показе). */
export async function loadCardInvite(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('student_card_invite', { p_card: id })
  if (error) throw dbError(error, 'получить код приглашения')
  return data
}
