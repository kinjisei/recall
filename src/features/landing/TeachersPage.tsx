// ============================================================================
// Лендинг «для преподавателей» (роут /teachers, открытый — работает без
// входа). Продаёт режим репетитора Recall репетиторам английского и испанского
// в Казахстане. Описание и правила — features/landing/CLAUDE.md: на «вы»,
// расписание и учёт первыми, тексты утверждает владелец (landingContent.ts),
// цены — из каталога domains/billing, связь — общий блок ContactLinks.
// Копирайт: конкретика вместо обещаний, без выдуманных отзывов
// (соц. доказательства появятся после пилота).
// ============================================================================

import { SUPPORT_SLA } from '../../shared/lib/contacts'
import { useInShell } from '../../shared/lib/shellInsets'
import { BrandLogo } from '../../shared/ui/Brand'
import { AppLink } from '../../shared/ui/AppLink'
import { ContactLinks } from '../../shared/ui/ContactLinks'
import { IconCards } from '../../shared/ui/icons'
import { BETWEEN_LESSONS, FAQ, INSIDE, REFERRAL } from './landingContent'
import { CTA, MIN_TEACHER_PRICE, PlanCards, ReportSample } from './LandingParts'

const SECTION = 'border-t border-tint/[0.06] py-10'
const CARD = 'rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card'
// неразрывные пробелы: «От» и «₸» не отрываются от числа при переносе строки
const fromPrice = `От\u00a0${MIN_TEACHER_PRICE.toLocaleString('ru-RU')}\u00a0₸ в месяц`

export function TeachersPage() {
  // Вошедший видит лендинг внутри общей рамки приложения (меню, вкладки):
  // своя шапка «логотип + Войти» и свои поля ему не нужны — их даёт каркас.
  const inShell = useInShell()
  const Frame = inShell ? 'div' : 'main'
  return (
    <Frame className={inShell ? undefined : 'min-h-[100dvh] bg-page text-fg'}>
      {/* шапка: логотип + вход — только гостю; фон — страница темы, не тёмный литерал */}
      {!inShell && (
        <header className="sticky top-0 z-20 border-b border-tint/[0.06] bg-page/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-screen-md items-center justify-between px-5 py-3">
            <BrandLogo width={92} />
            <AppLink
              to="/login?role=teacher"
              className="flex min-h-10 items-center rounded-full border border-tint/[0.12] px-4 text-sm text-fg-secondary"
            >
              Войти
            </AppLink>
          </div>
        </header>
      )}

      <div className={inShell ? 'pb-4' : 'mx-auto max-w-screen-md px-5 pb-16'}>
        {/* ---- Первый экран: расписание и учёт, как на звонке (Ф2.13) ---- */}
        <section className="flex flex-col items-center gap-6 pb-12 pt-10 text-center">
          <p className="rounded-full border border-accent-line px-3 py-1 text-xs text-accent-strong">
            Для репетиторов английского и испанского
          </p>
          <h1 className="max-w-xl text-[2rem] font-semibold leading-tight tracking-tight">
            Расписание, оплаты и домашка всех учеников — в одном месте.
            <br />
            <span className="text-accent-strong">А материалы и разбор работ готовит AI.</span>
          </h1>
          <p className="max-w-lg text-body leading-relaxed text-fg-tertiary">
            Уроки, переносы, кто сколько оплатил и кому пора напомнить — всё в одном
            расписании. {fromPrice}, ученикам — бесплатно.
          </p>
          <CTA />
          <ReportSample />
        </section>

        {/* ---- Что внутри: один блок вместо «Как это работает» + «Что внутри» ---- */}
        <section className={SECTION}>
          <h2 className="text-center text-xl font-semibold">Что внутри</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {INSIDE.map(({ Icon, title, desc }) => (
              <div key={title} className={CARD}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
                  <Icon size={18} />
                </span>
                <p className="mt-2.5 font-medium">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-tertiary">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Между уроками ---- */}
        <section className={SECTION}>
          <div className="rounded-2xl border border-accent-line-soft bg-accent/[0.07] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <IconCards size={20} className="text-accent-strong" />
              Между уроками ученик не пропадает
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-secondary">{BETWEEN_LESSONS}</p>
          </div>
        </section>

        {/* ---- Цены ---- */}
        <section className={SECTION}>
          <h2 className="text-center text-xl font-semibold">Цена зависит от числа учеников</h2>
          <p className="mx-auto mt-1 max-w-md text-center text-sm text-fg-muted">
            {fromPrice}. Ученикам — бесплатно.
          </p>
          <PlanCards />
          <p className="mx-auto mt-3 max-w-md text-center text-xs leading-relaxed text-fg-muted">{REFERRAL}</p>
          <div className="mt-6 flex justify-center">
            <CTA label="Начать пробный период" />
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className={SECTION}>
          <h2 className="text-center text-xl font-semibold">Частые вопросы</h2>
          <div className="mt-6 flex flex-col gap-3">
            {FAQ.map((f) => (
              <div key={f.q} className={CARD}>
                <p className="font-medium">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-tertiary">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Финал ---- */}
        <section className="border-t border-tint/[0.06] py-12 text-center">
          <h2 className="text-xl font-semibold">14 дней — достаточно, чтобы понять</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-tertiary">
            Заведите расписание, подключите одного ученика и назначьте ему материал.
            Через неделю будет видно, экономит ли Recall вам время. Если нет — просто не платите.
          </p>
          <div className="mt-5">
            <CTA />
          </div>
          {/* Живой человек на другом конце — для холодного посетителя это часто
              решает больше, чем ещё один блок про возможности */}
          <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3">
            <p className="text-sm text-fg-tertiary">Вопросы по проекту — напишите нам:</p>
            <ContactLinks subject="Recall — вопрос от преподавателя" />
            <p className="text-xs text-fg-muted">{SUPPORT_SLA}.</p>
          </div>
          <p className="mt-6 text-xs text-fg-muted">
            <AppLink to="/pricing" className="underline">Все тарифы</AppLink> ·{' '}
            <AppLink to="/terms" className="underline">Условия</AppLink> ·{' '}
            <AppLink to="/privacy" className="underline">Конфиденциальность</AppLink>
          </p>
        </section>
      </div>
    </Frame>
  )
}
