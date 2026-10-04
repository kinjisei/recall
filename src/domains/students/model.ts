// ============================================================================
// Карточки учеников — типы и чистые правила для показа (PLAN.md Ф2.5; журнал
// п.25, 28, 64; архитектура §18). Без импортов из базы: проверяется в node
// (scripts/test-student-cards.mjs).
//
// Правило мест живёт в базе (holds_seat, миграция 0008): экран берёт готовый
// ответ «держит ли место» из get_my_student_cards и сам «первых N» не считает.
// Здесь — только копия списка статусов, занимающих место (cardTakesSeat), для
// подписей; пару с card_takes_seat сверяет check-student-cards.mjs.
// ============================================================================
import { waPhone } from '../../shared/lib/share.ts'

export type CardStatus = 'trial' | 'active' | 'paused' | 'archived'

export const CARD_STATUSES: readonly CardStatus[] = ['trial', 'active', 'paused', 'archived']

/** Бейдж статуса (макет t6). */
export const STATUS_LABEL: Record<CardStatus, string> = {
  trial: 'Пробный',
  active: 'Занимается',
  paused: 'Пауза',
  archived: 'В архиве',
}

/**
 * Занимает ли статус место тарифа — копия card_takes_seat (миграция 0008).
 * Пробный и архив места не занимают и общего запаса студии не получают
 * (журнал п.64): иначе «вечно пробные» обходили бы лимит мест.
 */
export function cardTakesSeat(status: CardStatus): boolean {
  return status === 'active' || status === 'paused'
}

/** Карточка ученика — строка get_my_student_cards. */
export interface StudentCard {
  id: string
  /** Аккаунт ученика — только пока он в приложении. */
  userId: string | null
  name: string
  /** Телефон или ник в Telegram — одной строкой. */
  contact: string | null
  note: string | null
  status: CardStatus
  createdAt: string
  updatedAt: string
  /** Ученик в приложении (есть связь teacher_students). */
  inApp: boolean
  /** Когда ученик привязался — по этой дате база раздаёт места «первым N». */
  linkedAt: string | null
  /** Учитель отметил место руками. */
  seat: boolean
  /** Держит ли место тарифа — решает база (holds_seat). */
  holdsSeat: boolean
}

/** Фильтр списка (макет t6-1). «Все» — без архива. */
export type CardFilter = 'all' | 'active' | 'trial' | 'paused' | 'archived'

export const CARD_FILTERS: readonly { id: CardFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Занимаются' },
  { id: 'trial', label: 'Пробные' },
  { id: 'paused', label: 'Пауза' },
  { id: 'archived', label: 'Архив' },
]

export function matchesFilter(card: Pick<StudentCard, 'status'>, filter: CardFilter): boolean {
  return filter === 'all' ? card.status !== 'archived' : card.status === filter
}

const fold = (s: string) => s.toLocaleLowerCase('ru').replace(/ё/g, 'е')

/** Поиск по имени и контакту, без учёта регистра и «ё». */
export function matchesQuery(card: Pick<StudentCard, 'name' | 'contact'>, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  return fold(card.name).includes(q) || fold(card.contact ?? '').includes(q)
}

/** Инициалы для аватара: «Әсел Жұмабаева» → «ӘЖ». */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => [...p][0] ?? '')
  return letters.join('').toLocaleUpperCase('ru') || '?'
}

/** Имя для обращения в приглашении: «Тимур Ким» → «Тимур». */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/**
 * Куда написать ученику (макет t6-2: WhatsApp · Telegram · Позвонить).
 * Контакт — одна строка: номер даёт WhatsApp и звонок, «@ник» или
 * t.me/ник — Telegram. Непонятное — ничего, строка видна как есть.
 */
export function contactLinks(contact: string | null): {
  whatsapp: string | null
  telegram: string | null
  phone: string | null
} {
  const c = (contact ?? '').trim()
  const tg = c.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([A-Za-z0-9_]{4,32})$/)
  if (tg) return { whatsapp: null, telegram: `https://t.me/${tg[1]}`, phone: null }
  const wa = /^[+\d\s()-]+$/.test(c) ? waPhone(c) : null
  if (!wa) return { whatsapp: null, telegram: null, phone: null }
  return { whatsapp: `https://wa.me/${wa}`, telegram: null, phone: `tel:+${wa}` }
}

/** Ученик в приложении, которому полагается место, но мест не хватило. */
export function outsideSeats(card: StudentCard, seatsLimited: boolean): boolean {
  return seatsLimited && card.inApp && cardTakesSeat(card.status) && !card.holdsSeat
}

/** Пункты меню карточки (макет t6-3) — по статусу. */
export type CardAction = 'edit' | 'activate' | 'pause' | 'resume' | 'archive' | 'unarchive'

export function cardActions(status: CardStatus): CardAction[] {
  switch (status) {
    case 'trial':
      return ['edit', 'activate', 'archive']
    case 'active':
      return ['edit', 'pause', 'archive']
    case 'paused':
      return ['edit', 'resume', 'archive']
    case 'archived':
      return ['edit', 'unarchive']
  }
}

/** Куда ведёт пункт меню. «Вернуть из архива» — «занимается» (как и join_teacher). */
export const ACTION_STATUS: Record<Exclude<CardAction, 'edit'>, CardStatus> = {
  activate: 'active',
  pause: 'paused',
  resume: 'active',
  archive: 'archived',
  unarchive: 'active',
}

export const ACTION_LABEL: Record<CardAction, string> = {
  edit: 'Изменить данные',
  activate: 'Занимается — не пробный',
  pause: 'На паузу',
  resume: 'Снять с паузы',
  archive: 'В архив',
  unarchive: 'Вернуть из архива',
}

// ---- места тарифа ------------------------------------------------------------------

/** Сколько мест и сколько занято — из get_my_plan. seats: null — без ограничения. */
export interface SeatsState {
  seats?: number | null
  seats_used?: number | null
}

/** Тихая строка над списком: «В приложении 3 из 5 мест тарифа». */
export function seatsLine(s: SeatsState | null): string | null {
  if (!s || typeof s.seats !== 'number' || s.seats <= 0) return null
  return `В приложении ${s.seats_used ?? 0} из ${s.seats} мест тарифа`
}

/**
 * Подпись под приглашением (макет t6-4): займёт ли ученик место. Пробный —
 * не займёт; мест нет — войти не получится, пока не освободится место.
 */
export function inviteSeatHint(card: Pick<StudentCard, 'status'>, s: SeatsState | null): string | null {
  if (!cardTakesSeat(card.status)) return 'Пробный ученик место в тарифе не займёт.'
  if (!s || typeof s.seats !== 'number' || s.seats <= 0) return null
  const used = s.seats_used ?? 0
  if (used >= s.seats) {
    return `Мест в тарифе нет (${used} из ${s.seats}) — код не сработает, пока не освободишь место или не расширишь тариф.`
  }
  return `Займёт место в тарифе: будет ${used + 1} из ${s.seats}.`
}

// ---- приглашение ---------------------------------------------------------------------

/**
 * Код из ссылки-приглашения (?join=): 6 знаков алфавита кодов базы
 * (new_invite_code — без 0, 1, I, L, O). Мусор — null.
 */
export function parseJoinCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return /^[A-HJKMNP-Z2-9]{6}$/.test(code) ? code : null
}

/** Ссылка: вход или регистрация, код подставится в поле «Код преподавателя». */
export function cardInviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/login?join=${encodeURIComponent(code)}`
}

/** Код как его удобно продиктовать: «K7M 2PX». */
export function spacedCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

/**
 * Текст приглашения без ссылки (ссылку Telegram приклеивает сам).
 * Расписание названо с Ф2.7 (решение владельца 04.10.2026): свои уроки
 * ученик увидит на экране «Мои уроки» — он появится в Ф2.9.
 */
export function cardInviteText(name: string, code: string): string {
  return (
    `${firstName(name)}, присоединяйся к моим занятиям в Recall — там расписание уроков, домашка и задания от меня. ` +
    `Открой ссылку или введи код преподавателя ${code}:`
  )
}

/** Сообщение целиком — так его увидит ученик (и так оно уходит в WhatsApp). */
export function cardInviteMessage(name: string, code: string, link: string): string {
  return `${cardInviteText(name, code)} ${link}`
}
