// ============================================================================
// Общие куски «Пригласи коллегу» для телефона (t8) и компьютера (d13):
// шаги «Как это работает» и строка «подарок ждёт твоей первой оплаты».
// ============================================================================
import { REFERRAL_BONUS_DAYS, rewardShort, type Reward } from '../../domains/billing'
import { plural } from '../../shared/lib/plural'
import { AppLink } from '../../shared/ui/AppLink'

export const HOW_STEPS: { title: string; note?: string }[] = [
  { title: 'Отправь ссылку коллеге' },
  { title: 'Коллега регистрируется', note: `и получает +${REFERRAL_BONUS_DAYS} дней пробного периода` },
  { title: 'Коллега оплачивает первый месяц', note: 'а тебе — месяц тарифа бесплатно' },
]

/**
 * Что получено подарком — плитка счётчика: только месяцы — «1 · Бесплатный
 * месяц» (d13-1); есть дни (коллега оплатил тариф дешевле) — «1 мес 18 дн ·
 * Получено», чтобы дни не прятались за словом «месяцев».
 */
export function rewardTile(r: Reward): { value: string; label: string } {
  if (r.days === 0) return { value: String(r.months), label: plural(r.months, 'Бесплатный месяц', 'Бесплатных месяца', 'Бесплатных месяцев') }
  return { value: rewardShort(r), label: 'Получено' }
}

/**
 * Коллеги оплатили, а тарифа репетитора у тебя ещё не было — подарки ждут и
 * добавятся к первой оплате (0006). Истёкший тариф база продлевает сразу,
 * поэтому здесь всегда «первой».
 */
export function Pending({ count }: { count: number }) {
  return (
    <p className="text-note text-fg-muted" data-referral-pending>
      {count === 1
        ? 'Подарок за одного коллегу ждёт твоей первой оплаты тарифа — добавим его сами. '
        : `Подарки за ${count} ${plural(count, 'коллегу', 'коллег', 'коллег')} ждут твоей первой оплаты тарифа — добавим их сами. `}
      <AppLink to="/pay" className="font-medium text-accent-strong">
        Как оплатить
      </AppLink>
    </p>
  )
}
