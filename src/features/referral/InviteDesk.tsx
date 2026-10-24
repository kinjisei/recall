// ============================================================================
// «Пригласи коллегу» на компьютере (макеты d13-1 «3 · 1 · 1», d13-2 «Пока
// никого»): шаги карточками в две колонки — слева «1 Твоя ссылка» (поле и
// «Скопировать») и «2 Отправь коллеге» (WhatsApp · Telegram · «Ещё…» и как
// увидит коллега), справа «3 Что получите оба» (коллеге +7 дней, тебе +1
// месяц, «Без ограничений», счётчик; пусто — «Пока никого…» и нули тише) и
// «Как это работает». Логика ссылки — useInviteShare, общая с телефоном.
// ============================================================================
import { cheaperNote, planCard, planShortTitle, REFERRAL_BONUS_DAYS, TEACHER_PLANS, type ReferralStats, type TeacherPlanId } from '../../domains/billing'
import { plural } from '../../shared/lib/plural'
import { Button } from '../../shared/ui/Button'
import { StepCard } from '../../shared/ui/Card'
import { IconCheck, IconCopy, IconHeart, IconInfinity, IconShare } from '../../shared/ui/icons'
import { MainAside } from '../../shared/ui/layouts'
import { SHARE_OUTLINE, ShareLink } from '../../shared/ui/ShareLink'
import { HOW_STEPS, Pending, rewardTile } from './inviteBits'
import { canShareNative, useInviteShare } from './useInviteShare'

const teacherPlans = TEACHER_PLANS as TeacherPlanId[]
const PRICES = Object.fromEntries(teacherPlans.map((p) => [p, planCard(p).price])) as Record<TeacherPlanId, number>
const TITLES = Object.fromEntries(teacherPlans.map((p) => [p, planShortTitle(p)])) as Record<TeacherPlanId, string>

export function InviteDesk({ stats, mine }: { stats: ReferralStats; mine: TeacherPlanId | null }) {
  const s = useInviteShare(stats.code)
  const empty = stats.invited === 0
  const got = rewardTile(stats.reward)
  const note = cheaperNote(mine, PRICES, TITLES)
  // ссылка в сообщении — цветом ссылки, как в кадре
  const at = s.message.lastIndexOf(s.link)
  const [before, after] = at >= 0 ? [s.message.slice(0, at), s.message.slice(at + s.link.length)] : [s.message, '']

  return (
    <MainAside
      size="fill"
      label="Что получите оба"
      main={
        <div className="flex flex-col gap-4">
          <StepCard n={1} title="Твоя ссылка">
            <div className="flex items-center gap-2.5">
              {/* ссылка выделяется целиком — если буфер недоступен, копируют руками */}
              <span className="flex h-13 min-w-0 flex-1 select-all items-center truncate rounded-control-sm bg-input px-3.5 text-body tabular-nums text-fg" data-referral-link={s.link}>
                <span className="truncate">{s.shown}</span>
              </span>
              <Button size="lg" className="flex-none px-5" onClick={() => void s.copyLink()}>
                {s.copied === 'link' ? <IconCheck size={18} aria-hidden /> : <IconCopy size={18} aria-hidden />}
                {s.copied === 'link' ? 'Скопировано' : 'Скопировать'}
              </Button>
            </div>
            {s.failed && <p className="text-note text-fg-muted">Не получилось скопировать — выдели ссылку и скопируй вручную.</p>}
            {s.copied === 'message' && <p className="text-note text-fg-muted">Сообщение скопировано — вставь его, куда удобно.</p>}
          </StepCard>

          <StepCard n={2} title="Отправь коллеге">
            <div className="flex flex-wrap gap-2">
              <ShareLink outline channel="whatsapp" href={s.whatsapp} onClick={s.tracked('whatsapp')} />
              <ShareLink outline channel="telegram" href={s.telegram} onClick={s.tracked('telegram')} />
              {canShareNative && (
                <button type="button" className={SHARE_OUTLINE} onClick={() => void s.shareMore()}>
                  <IconShare size={18} aria-hidden /> Ещё…
                </button>
              )}
            </div>
            <span className="mx-0.5 -mb-1.5 text-note font-medium text-fg-muted">Так увидит коллега</span>
            <p className="whitespace-pre-line break-words rounded-control-lg rounded-bl-mark bg-input px-4 py-3.5 text-body text-fg" data-referral-message>
              {before}
              {at >= 0 && <span className="break-all text-accent-soft-fg underline underline-offset-2">{s.link}</span>}
              {after}
            </p>
          </StepCard>
        </div>
      }
      aside={
        <>
          <StepCard n={3} title="Что получите оба">
            <div className="grid grid-cols-2 gap-2">
              <Gift label="Коллеге" big={`+${REFERRAL_BONUS_DAYS} ${plural(REFERRAL_BONUS_DAYS, 'день', 'дня', 'дней')}`} text="пробного периода" />
              <Gift label="Тебе" big="+1 месяц" text="тарифа бесплатно за каждого, кто оплатит первый месяц" />
            </div>
            {note && <p className="text-note text-fg-muted">{note}</p>}
            {!mine && <p className="text-note text-fg-muted">Своего тарифа пока нет — подарок подождёт и добавится к первой оплате.</p>}
            <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-surface px-2.5 text-note font-semibold text-fg-secondary inset-ring inset-ring-line">
              <IconInfinity size={16} aria-hidden className="text-accent-strong" /> Без ограничений
            </span>
            {empty && (
              <p className="flex gap-2.5 rounded-control-sm bg-accent-soft px-3.5 py-3 text-sm text-accent-soft-fg" data-referral-empty>
                <IconHeart size={18} aria-hidden className="mt-0.5 flex-none" />
                Пока никого. Начни с одного коллеги — того, кому это пригодится.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2" aria-label="Счётчик приглашений" data-referral-counter>
              <Count value={String(stats.invited)} label="Приглашено" quiet={empty} />
              <Count value={String(stats.paid)} label="Оплатили" quiet={empty} />
              <Count value={got.value} label={got.label} quiet={empty} />
            </div>
            {stats.pending > 0 && <Pending count={stats.pending} />}
          </StepCard>
          <StepCard title="Как это работает">
            <ol className="flex flex-col gap-2.5">
              {HOW_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-3 text-body">
                  <span aria-hidden className="flex size-6.5 flex-none items-center justify-center rounded-full bg-input text-note font-bold text-fg-secondary">
                    {i + 1}
                  </span>
                  <span className="leading-snug">
                    {step.title}
                    {step.note && <small className="block text-note text-fg-secondary">{step.note}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </StepCard>
        </>
      }
    />
  )
}

/** Половина «что получите» (`.gift`): мягкий акцент, метка капсом, крупно, пояснение. */
function Gift({ label, big, text }: { label: string; big: string; text: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-accent-soft p-3.5 text-accent-soft-fg">
      <small className="text-xs font-bold uppercase tracking-wider">{label}</small>
      <b className="text-2xl font-bold leading-tight">{big}</b>
      <span className="text-note leading-snug">{text}</span>
    </div>
  )
}

/** Плитка счётчика (`.cnt13`): число 24 и подпись; пока никого — числа тише. */
function Count({ value, label, quiet }: { value: string; label: string; quiet: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-input px-3.5 py-3">
      <b className={`text-2xl font-bold leading-tight tabular-nums ${quiet ? 'text-fg-muted' : 'text-fg'}`}>{value}</b>
      <span className="text-note leading-snug text-fg-secondary">{label}</span>
    </div>
  )
}
