// ============================================================================
// «Как оплатить тариф» (роут /pay; PLAN.md Ф2.1; макет t9-4). Выбрал тариф →
// перевёл на Kaspi Gold с личным кодом в сообщении → «Оплата отправлена»:
// владельцу приходит заявка, он сверяет перевод и подтверждает в /admin, тариф
// включается, человеку — «Оплата получена» в колокольчике.
//
// Репетитору — его три тарифа, ученику — Premium; ссылка ?plan= выбирает
// тариф сразу (с карточки на странице тарифов). Открытая заявка переживает
// перезаход: экран показывает «Спасибо», пока её не подтвердят или не уберут.
// Раскладка одна на все ширины — колонка: форма короткая, на компьютере ей
// ширина колонки впору.
// ============================================================================
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppLink } from '../../shared/ui/AppLink'
import { BackButton } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { IconBadgeCheck, IconHint } from '../../shared/ui/icons'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import {
  amountFor,
  initialPlanToPay,
  loadPayInfo,
  planCard,
  planNow,
  planNowLabel,
  plansToPay,
  planShortTitle,
  reportPaymentSent,
  type PaidPlan,
  type PayInfo,
  type PaymentClaim,
} from '../../domains/billing'
import { KaspiTransfer } from './KaspiTransfer'

export function PayPage() {
  const [params] = useSearchParams()
  const info = useAsyncData(loadPayInfo, [], 'Не удалось загрузить данные для оплаты')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackButton fallback="/pricing" />
      </div>
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Как оплатить тариф</h1>
        {info.data && <p className="mt-1 text-sm text-fg-muted">Сейчас: {planNowLabel(info.data)}</p>}
      </header>
      {info.error ? (
        <LoadError message={info.error} onRetry={info.reload} />
      ) : info.data ? (
        <PayForm info={info.data} requested={params.get('plan')} />
      ) : (
        <RowsSkeleton count={4} />
      )}
    </div>
  )
}

function Price({ amount }: { amount: number }) {
  return (
    <>
      <span className="block font-medium text-fg">{amount.toLocaleString('ru-RU')} ₸</span>
      <span className="block text-caption text-fg-muted">в месяц</span>
    </>
  )
}

function PayForm({ info, requested }: { info: PayInfo; requested: string | null }) {
  const options = plansToPay(info.role, requested)
  // открытая заявка важнее нынешнего тарифа: вернулся после «Оплата
  // отправлена» — видит «Спасибо», а не «перевёл за другой?»
  const [plan, setPlan] = useState<PaidPlan>(() => initialPlanToPay(options, info.claim?.plan ?? info.plan, requested))
  const [claim, setClaim] = useState<PaymentClaim | null>(info.claim)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = planNow(info)
  const mine = now.kind === 'paid' || now.kind === 'ended' ? now.plan : null
  // заявка на этот же тариф — «Спасибо»; на другой — можно поправить
  const sent = claim !== null && claim.plan === plan

  const report = async () => {
    setBusy(true)
    setError(null)
    try {
      setClaim(await reportPaymentSent(plan))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось отправить — попробуй ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section>
        <h2 className="mb-2 text-sm text-fg-muted">Тариф</h2>
        <ChoiceGroup
          variant="cards"
          label="Тариф"
          value={plan}
          onChange={setPlan}
          options={options.map((id) => {
            const card = planCard(id)
            const what = card.studentLimit ? `${card.studentLimit} учеников в приложении` : card.tagline
            return {
              id,
              label: planShortTitle(id),
              hint: id === mine ? `${what} · сейчас у тебя` : what,
              trailing: <Price amount={amountFor(id, 1)} />,
            }
          })}
        />
        {/* репетитор приходит сюда из меню профиля, минуя страницу тарифов */}
        <AppLink to="/pricing" className="mt-2 inline-block text-note text-accent-strong">
          Что входит в каждый тариф
        </AppLink>
      </section>

      <KaspiTransfer amount={amountFor(plan, 1)} code={info.code} />

      {sent ? (
        <SentCard claim={claim} />
      ) : (
        <div>
          <Button className="min-h-12 w-full" loading={busy} onClick={report}>
            Оплата отправлена
          </Button>
          {error && <p className="mt-2 text-sm text-danger-strong">{error}</p>}
          {claim ? (
            <p className="mt-2 text-note text-fg-muted">
              Мы уже ждём оплату за {planShortTitle(claim.plan as PaidPlan)}. Перевёл за {planShortTitle(plan)} — нажми, и
              мы поправим заявку.
            </p>
          ) : (
            <p className="mt-2 flex gap-2 text-note text-fg-muted">
              <IconHint size={16} className="mt-0.5 flex-none text-fg-faint" />
              <span>Нажми после перевода — мы проверим и включим тариф.</span>
            </p>
          )}
        </div>
      )}
    </>
  )
}

function SentCard({ claim }: { claim: PaymentClaim }) {
  const at = new Date(claim.created_at).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <Card className="animate-fade-up flex flex-col items-center gap-2 text-center">
      <IconBadgeCheck size={28} className="text-success-strong" />
      <p className="text-lg font-medium">Спасибо! Включим тариф в течение дня</p>
      <p className="text-sm text-fg-muted">
        Как только включим, придёт уведомление, и всё заработает с того же места — ничего не пропадёт.
      </p>
      <p className="text-note text-fg-muted">Заявка отправлена {at}</p>
    </Card>
  )
}
