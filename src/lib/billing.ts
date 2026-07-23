// ============================================================================
// Тарифы Recall — типы, статичные данные о планах и чтение своего тарифа.
// Оплата ручная (Kaspi-перевод → админ включает план в БД), RPC get_my_plan
// ещё может быть не создана в базе на момент деплоя этого экрана — поэтому
// getMyPlan() при любой ошибке молча возвращает null, а не бросает.
// ============================================================================
import { supabase } from './supabase'

export type Plan = 'free' | 'premium' | 'teacher_mini' | 'teacher_start' | 'teacher_pro'

/** Свой тариф — то, что вернёт RPC get_my_plan() (когда появится в БД). */
export interface MyPlan {
  plan: Plan
  /** До какого момента план оплачен (ISO), null — free без срока. */
  plan_expires_at: string | null
  /** До какого момента действует триал (ISO), null — триала нет/закончился. */
  trial_until: string | null
  is_admin: boolean
  /** Есть ли сейчас полный (premium-уровня) доступ к AI — свой план, триал или учитель-бенефит. */
  premium: boolean
  ai_used_today: number
  ai_day_limit: number
}

export interface PlanCard {
  id: Plan
  title: string
  /** ₸/мес, 0 — бесплатно. */
  price: number
  /** Короткая подпись под ценой. */
  tagline: string
  /** Список того, что входит. */
  features: string[]
  /** Лимит учениц — только для тарифов преподавателя. */
  studentLimit?: number
}

export const PLANS: PlanCard[] = [
  {
    id: 'free',
    title: 'Free',
    price: 0,
    tagline: 'Навсегда бесплатно',
    features: [
      'Слова, тексты, грамматика и игры — без лимитов',
      'Перевод слов по тапу и проверка произношения — тоже без лимитов',
      '5 разговоров с AI в день (Диалог, проверка письма, квесты)',
    ],
  },
  {
    id: 'premium',
    title: 'Premium',
    price: 1490,
    tagline: 'Для самостоятельного изучения',
    features: [
      'Всё из Free',
      'До 200 разговоров с AI в день — на практике это «сколько нужно»',
      'Приоритет на самых умных моделях в Диалоге и разборе работ',
    ],
  },
  {
    id: 'teacher_mini',
    title: 'Репетитор · Mini',
    price: 3000,
    tagline: 'До 5 учениц',
    studentLimit: 5,
    features: [
      'Материалы, задания, проверка работ',
      'AI-квесты по грамматике',
      'Ученицы получают Premium-доступ к AI бесплатно',
    ],
  },
  {
    id: 'teacher_start',
    title: 'Репетитор · Start',
    price: 5000,
    tagline: 'До 10 учениц',
    studentLimit: 10,
    features: ['Всё из Mini', 'До 10 учениц одновременно'],
  },
  {
    id: 'teacher_pro',
    title: 'Репетитор · Pro',
    price: 12000,
    tagline: 'До 30 учениц',
    studentLimit: 30,
    features: ['Всё из Mini', 'До 30 учениц одновременно'],
  },
]

export const KASPI = {
  phone: '+7 776 210 02 21',
  name: 'Ерболат',
}

/**
 * Свой тариф из БД. RPC get_my_plan может быть ещё не создана (миграция не
 * выполнена) или пользователь не авторизован — в обоих случаях просто null,
 * экран тарифов должен работать и без неё (публичная страница).
 */
export async function getMyPlan(): Promise<MyPlan | null> {
  try {
    const { data, error } = await supabase.rpc('get_my_plan')
    if (error || !data) return null
    return data as MyPlan
  } catch {
    return null
  }
}
