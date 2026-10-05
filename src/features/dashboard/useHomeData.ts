// ============================================================================
// Первый кадр Главной: все входы разом — и честно о том, что не пришло.
//
// ⚠️ ОДИН согласованный первый кадр, а не семь независимых. Было: каждый
// запрос рисовал свой кусок по мере прихода — стрик, потом полоска энергии в
// середине (двигая всё вниз), потом план, потом карточка программы. Экран
// собирался на глазах рывками. Теперь ждём все входы разом; пока ждём —
// скелетон той же раскладки. Страховка: если сеть висит, через 4 с рисуем
// рамку, а куски, которых ещё нет, держат место.
//
// Без сети (PLAN.md Ф1.13) каждый вход раньше гасил ошибку сам, и Главная
// рисовала «Серия дней подряд 0» и план по умолчанию, ни слова не сказав о
// связи. Теперь вход, который упал или не ответил за LOAD_TIMEOUT_MS,
// попадает в failed: Главная показывает плашку с «Повторить» и прячет то,
// чего не знает, вместо выдуманных нулей.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { loadProfile } from '../../lib/profile'
import { loadHomeActivity, type HomeActivity } from '../../lib/activity'
import { getMyDailyPlanConfig, type DailyPlanConfig } from '../../lib/dailyPlan'
import { listMyQuests } from '../../lib/quests'
import { getMyPlans, isProgramSeen } from '../../lib/studyPlan'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { settleAll } from '../../shared/lib/settleAll'
import { loadAssignmentCounts, type AssignmentCounts } from '../teacher'
import { HOME_LESSONS_AHEAD_DAYS, loadMyLessons, type MyLesson } from '../../domains/schedule'
import type { Profile, StudyPlan } from '../../types'

/** Через сколько показать рамку, даже если не все входы пришли. */
const FIRST_FRAME_GUARD_MS = 4000
const HOUR_MS = 3_600_000

/**
 * Уроки ученика для карточки «Ближайший урок» (Ф2.9): от 8 часов назад (урок
 * длиной до 8 ч может идти прямо сейчас) до двух недель вперёд.
 */
const homeLessons = () =>
  loadMyLessons(new Date(Date.now() - 8 * HOUR_MS), new Date(Date.now() + HOME_LESSONS_AHEAD_DAYS * 24 * HOUR_MS))

export interface HomeData {
  profile: Profile | null
  /** null — не загрузилось: серию не показываем, а не рисуем «0». */
  activity: HomeActivity | null
  assignments: AssignmentCounts | null
  /**
   * Входы плана дня (настройка учителя, задания, квесты) — только вместе:
   * иначе «идеальный день» засчитывался по неполному дефолтному плану
   * (находка ревью 2026-07-24). null — какой-то не пришёл.
   */
  planInputs: { dailyCfg: DailyPlanConfig | null; activeQuests: number } | null
  myPlan: MyPlan | null
  /** Программа, которую ученик ещё не открывал (флаг recall.program_seen.<id>). */
  newProgram: StudyPlan | null
  /** Уроки на ближайшие две недели; null — не загрузились (карточки нет, плашка о связи). */
  lessons: MyLesson[] | null
}

export interface HomeLoad {
  /** null — ещё грузим. */
  data: HomeData | null
  /** Пора рисовать рамку (всё пришло или сработала страховка). */
  ready: boolean
  /** Сколько входов не ответило. */
  failed: number
  reload: () => void
}

export function useHomeData(userId: string | undefined): HomeLoad {
  const [attempt, setAttempt] = useState(0)
  // Результат помнит, к какой загрузке относится: новая загрузка («Повторить»,
  // другой пользователь) сама даёт «ещё грузим», без сброса состояния в эффекте.
  const key = `${userId ?? ''}#${attempt}`
  const [result, setResult] = useState<{ key: string; data: HomeData; failed: number } | null>(null)
  const [guardKey, setGuardKey] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    const guard = window.setTimeout(() => alive && setGuardKey(key), FIRST_FRAME_GUARD_MS)

    void settleAll({
      profile: () => loadProfile(userId),
      // стрик + неделя + сделанное сегодня — одним запросом к activity_log
      activity: () => loadHomeActivity(),
      assignments: () => loadAssignmentCounts(),
      dailyCfg: () => getMyDailyPlanConfig(),
      quests: () => listMyQuests(),
      // тариф и энергия: функция сама отдаёт null при сбое — полоска просто не покажется
      plan: () => getMyPlan(),
      programs: () => getMyPlans(),
      lessons: homeLessons,
    }).then(({ values: v, failed: lost }) => {
      if (!alive) return
      const planOk = !lost.includes('dailyCfg') && !lost.includes('quests') && !lost.includes('assignments')
      const data: HomeData = {
        profile: v.profile,
        activity: v.activity,
        assignments: v.assignments,
        planInputs: planOk
          ? { dailyCfg: v.dailyCfg, activeQuests: (v.quests ?? []).filter((q) => q.status === 'assigned').length }
          : null,
        myPlan: v.plan,
        newProgram:
          (v.programs ?? []).find((p) => {
            try {
              return !isProgramSeen(p.id)
            } catch {
              return false
            }
          }) ?? null,
        lessons: v.lessons,
      }
      window.clearTimeout(guard)
      setResult({ key, data, failed: lost.length })
    })

    return () => {
      alive = false
      window.clearTimeout(guard)
    }
  }, [userId, key])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const current = result?.key === key ? result : null
  return {
    data: current?.data ?? null,
    ready: current !== null || guardKey === key,
    failed: current?.failed ?? 0,
    reload,
  }
}
