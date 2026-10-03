// ============================================================================
// Плашка «Тариф закончился — продлить» (PLAN.md Ф2.4, журнал п.36, макет
// t9-3). Раньше доступ пропадал молча и выглядел как поломка. Теперь после
// конца тарифа или пробного — спокойная плашка со ссылкой на «Как оплатить»,
// без красного: это не ошибка, а следующий шаг. Продлили — уходит сама.
//
// Где её показывать (стартовый экран, у репетитора ещё студия), решает каркас
// (app/navigation.ts `showsAccessBanner`); что сказать — правило
// `accessEndedNotice` (domains/billing): репетитору — тариф или пробный,
// самоучке — его Premium, ученику в студии репетитора — ничего.
// ============================================================================
import { useEffect, useState } from 'react'
import { accessEnd, accessEndedNotice } from '../../domains/billing'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { AppLink } from '../../shared/ui/AppLink'
import { IconTimer } from '../../shared/ui/icons'

const DAY_MS = 86400_000

export function AccessEndedBanner({ role }: { role: string }) {
  const [plan, setPlan] = useState<MyPlan | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // при каждом показе и при возврате в приложение — свежий тариф: владелец
  // подтвердил оплату — плашка уходит без перезагрузки. Сбой связи — null,
  // и плашки нет: «закончился» без данных было бы выдумкой
  useEffect(() => {
    let alive = true
    const read = () =>
      void getMyPlan().then((p) => {
        if (!alive) return
        setPlan(p)
        setNow(Date.now())
      })
    read()
    const onVisible = () => document.visibilityState === 'visible' && read()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [role])

  // конец наступил, пока экран открыт, — плашка появляется в тот же момент
  const left = plan ? (accessEnd(role, plan)?.until.getTime() ?? 0) - now : 0
  useEffect(() => {
    if (!(left > 0 && left < DAY_MS)) return
    const t = setTimeout(() => setNow(Date.now()), left + 1000)
    return () => clearTimeout(t)
  }, [left])

  const notice = plan ? accessEndedNotice(role, plan, new Date(now)) : null
  if (!notice) return null
  return (
    <section
      aria-label="Тариф"
      data-access-ended={notice.source}
      className="animate-fade-in mb-4 flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3"
    >
      <IconTimer size={20} className="flex-none text-accent-soft-fg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-accent-soft-fg">{notice.title}</p>
        <p className="text-caption leading-snug text-accent-soft-fg/80">{notice.body}</p>
      </div>
      <AppLink
        to="/pay"
        className="lift flex min-h-10 flex-none items-center rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg"
      >
        {notice.action}
      </AppLink>
    </section>
  )
}
