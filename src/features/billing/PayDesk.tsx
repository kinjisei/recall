// ============================================================================
// «Как оплатить тариф» на компьютере (макеты d13-3, d13-4, d13-3б): две
// колонки пополам — «1 Тариф» («Сейчас: Репетитор · Mini, действует до 12
// ноября», тарифы карточками на подложке поля, «Что входит в каждый тариф»)
// и «2 Перевод на Kaspi Gold» (таблица «Получатель · Номер · Сумма ·
// Сообщение» с «Номер» и «Код» в строке, подсказка про код, «Оплата
// отправлена»; после нажатия — зелёное «Спасибо…» на месте кнопки). Ниже —
// полоса «Что-то не сходится с оплатой — напишите нам». Состояние формы
// (тариф, заявка) — у PayForm, общее с телефоном. Страница на «вы».
// ============================================================================
import { useState } from 'react'
import { KASPI, planNowLabel, type PaidPlan, type PayInfo, type PaymentClaim } from '../../domains/billing'
import { useCopy } from '../../shared/lib/useCopy'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { StepCard } from '../../shared/ui/Card'
import { ChoiceGroup, type ChoiceOption } from '../../shared/ui/ChoiceGroup'
import { ContactLinks } from '../../shared/ui/ContactLinks'
import { IconBadgeCheck, IconCheck, IconChevronRight, IconCopy, IconInfo } from '../../shared/ui/icons'
import { MainAside } from '../../shared/ui/layouts'
import { ErrorText } from '../../shared/ui/ErrorText'

const money = (n: number) => `${n.toLocaleString('ru-RU')} ₸`

export function PayDesk({
  info,
  options,
  plan,
  onPlan,
  amount,
  sent,
  claim,
  busy,
  error,
  onReport,
  sentAt,
  retarget,
}: {
  info: PayInfo
  options: ChoiceOption<PaidPlan>[]
  plan: PaidPlan
  onPlan: (p: PaidPlan) => void
  amount: number
  /** Заявка на этот тариф уже отправлена — «Спасибо» вместо кнопки. */
  sent: boolean
  claim: PaymentClaim | null
  busy: boolean
  error: string | null
  onReport: () => void
  /** Когда отправлена заявка — «Заявка отправлена 22 октября, 15:40». */
  sentAt: string | null
  /** Ждём оплату за другой тариф — подсказка «нажмите, и мы поправим заявку». */
  retarget: string | null
}) {
  const now = planNowLabel(info)
  const cut = now.indexOf(', ')
  return (
    <MainAside
      size="half"
      label="Перевод на Kaspi Gold"
      main={
        <StepCard n={1} title="Тариф">
          <p className="rounded-control-sm bg-input px-3.5 py-3 text-body text-fg-secondary" data-pay-now>
            Сейчас: {cut > 0 ? <b className="font-semibold text-fg">{now.slice(0, cut)}</b> : now}
            {cut > 0 && now.slice(cut)}
          </p>
          <ChoiceGroup variant="cards" filled label="Тариф" value={plan} onChange={onPlan} options={options} />
          {/* репетитор приходит сюда из меню профиля, минуя страницу тарифов */}
          <AppLink to="/pricing" className="flex min-h-11 items-center gap-1 self-start text-body font-medium text-accent-strong">
            Что входит в каждый тариф <IconChevronRight size={16} aria-hidden />
          </AppLink>
        </StepCard>
      }
      aside={
        <StepCard n={2} title="Перевод на Kaspi Gold">
          <KaspiTable amount={amount} code={info.code} />
          <p className="flex gap-2.5 text-sm text-fg-secondary">
            <IconInfo size={16} aria-hidden className="mt-0.5 flex-none text-fg-muted" />
            Впишите код {info.code} в сообщение к переводу — так мы поймём, что оплата от вас. Забыли — не страшно: сверим по имени отправителя.
          </p>
          {sent && claim ? (
            <div role="status" className="animate-fade-up flex items-center gap-3 rounded-control bg-success-soft px-4 py-3.5 text-success-soft-fg" data-pay-sent>
              <IconBadgeCheck size={22} aria-hidden className="flex-none" />
              <span className="flex flex-col">
                <b className="text-base font-bold leading-snug">Спасибо! Включим тариф в течение дня</b>
                <small className="text-note">{sentAt ? `Заявка отправлена ${sentAt}. ` : ''}Как только включим, придёт уведомление</small>
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Button size="lg" loading={busy} onClick={onReport}>
                Оплата отправлена
              </Button>
              {error && <ErrorText>{error}</ErrorText>}
              <small className="text-center text-sm text-fg-secondary">{retarget ?? 'Нажмите после перевода — мы проверим и включим тариф'}</small>
            </div>
          )}
        </StepCard>
      }
    />
  )
}

/** Полоса связи под колонками (`.help13`). */
export function PayHelp() {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-row bg-surface px-4.5 py-3.5 shadow-card">
      <span className="flex-1 text-body text-fg-secondary">Что-то не сходится с оплатой — напишите нам</span>
      <ContactLinks inline subject="Recall — вопрос по оплате" />
    </section>
  )
}

/** Таблица перевода (`.kv13`): строка на поле, «Номер» и «Код» — копировать прямо в строке. */
function KaspiTable({ amount, code }: { amount: number; code: string }) {
  const { copied, copy } = useCopy()
  // буфер недоступен (старый браузер, запрет) — подсказать скопировать руками
  const [failed, setFailed] = useState(false)
  const copyOne = async (key: string, text: string) => setFailed(!(await copy(key, text)))
  const row = 'flex min-h-13 items-center gap-3 py-1 pl-3.5 pr-1.5'
  const label = 'w-25 flex-none text-sm text-fg-secondary'
  const value = 'min-w-0 flex-1 select-all text-base font-semibold tabular-nums text-fg'
  const cp = (key: string, text: string, title: string) => (
    <button type="button" onClick={() => void copyOne(key, text)} className="flex min-h-11 flex-none items-center gap-1.5 rounded-control-sm bg-accent-soft px-2.5 text-sm font-semibold text-accent-soft-fg">
      {copied === key ? <IconCheck size={16} aria-hidden /> : <IconCopy size={16} aria-hidden />}
      {copied === key ? 'Скопирован' : title}
    </button>
  )
  return (
    <>
      <div className="flex flex-col divide-y divide-line rounded-control inset-ring inset-ring-line" data-kaspi>
        <div className={row}>
          <span className={label}>Получатель</span>
          <b className={value}>{KASPI.name}</b>
        </div>
        <div className={row}>
          <span className={label}>Номер</span>
          <b className={value}>{KASPI.phone}</b>
          {cp('phone', KASPI.phone.replace(/\s/g, ''), 'Номер')}
        </div>
        <div className={row}>
          <span className={label}>Сумма</span>
          <b className={value}>{money(amount)}</b>
        </div>
        <div className={row}>
          <span className={label}>Сообщение к переводу</span>
          <b className={`${value} tracking-wider`}>{code}</b>
          {cp('code', code, 'Код')}
        </div>
      </div>
      {failed && <p className="text-note text-fg-muted">Не получилось скопировать — нажмите на номер или код и скопируйте вручную.</p>}
    </>
  )
}
