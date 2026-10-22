// ============================================================================
// Лендинг «для преподавателей» (роут /teachers, открытый — работает без
// входа; макет d15). Продаёт режим репетитора Recall репетиторам английского
// и испанского в Казахстане. Описание и правила — features/landing/CLAUDE.md:
// на «вы», расписание и учёт первыми, тексты утверждает владелец
// (landingContent.ts; в 4г-3 — раскладка макета, тексты прежние, журнал
// п.76 (13)), цены — из каталога domains/billing, связь — ContactLinks.
//
// Раскладка — по ширине самого лендинга (контейнер `landing`), а не окна:
// гостю он во весь экран со своей шапкой, вошедшему — в рамке с меню.
// Первый экран: слева метка, заголовок, подзаголовок и кнопка, справа рамка
// браузера с примером отчёта (от 1200; уже — одной колонкой, рамка под
// кнопкой). Секции чередуют фон страницы и поверхности; поля — 20 · 32 ·
// 40, на 1440 содержимое не шире 1280 (поля 80).
// ============================================================================
import { useRef } from 'react'
import { SUPPORT_SLA } from '../../shared/lib/contacts'
import { usePageWidth } from '../../shared/lib/screenWidth'
import { useInShell } from '../../shared/lib/shellInsets'
import { AppLink } from '../../shared/ui/AppLink'
import { ContactLinks } from '../../shared/ui/ContactLinks'
import { BETWEEN_LESSONS, FAQ, INSIDE, REFERRAL } from './landingContent'
import { LandingHeader, useScrolledPast } from './LandingHeader'
import { CTA, FaqList, MIN_TEACHER_PRICE, PhoneShot, PlanCards, ReferralStrip, ReportSample, ShotFrame } from './LandingParts'

// поля по ширине лендинга; шире 1360 — содержимое 1280 по центру (d15-3: поля 80 на 1440)
const PAD = 'px-5 @2xl/landing:px-8 @5xl/landing:px-[max(2.5rem,calc((100cqw-80rem)/2))]'
const H2 = 'text-section font-bold text-fg'
// неразрывные пробелы: «От» и «₸» не отрываются от числа при переносе строки
const fromPrice = `От\u00a0${MIN_TEACHER_PRICE.toLocaleString('ru-RU')}\u00a0₸ в месяц`
const footLink = 'inline-flex min-h-11 items-center text-fg-secondary hover:text-fg'

export function TeachersPage() {
  // Вошедший видит лендинг внутри общей рамки приложения (меню, вкладки):
  // своя шапка «логотип + Войти» ему не нужна, полосы секций — карточками.
  const inShell = useInShell()
  // в рамке — ширина страницы, а не колонка 640 старых экранов
  usePageWidth(inShell ? 'page' : undefined)
  const heroCta = useRef<HTMLDivElement>(null)
  const pastHero = useScrolledPast(heroCta, !inShell)
  const Frame = inShell ? 'div' : 'main'
  const band = (alt: boolean) => `${PAD} flex flex-col gap-7 py-16 ${alt ? `bg-surface ${inShell ? 'rounded-card' : ''}` : ''}`

  return (
    <Frame className={`@container/landing ${inShell ? 'pb-4' : 'min-h-dvh bg-page text-fg'}`}>
      {!inShell && <LandingHeader pad={PAD} showCta={pastHero} />}

      {/* ---- Первый экран (.hero15): текст слева, рамка с отчётом справа ---- */}
      <section
        className={`${PAD} grid items-center gap-10 pb-12 pt-8 @landing-split/landing:grid-cols-[minmax(0,1fr)_minmax(0,37.5rem)] @landing-split/landing:gap-12 @landing-wide/landing:grid-cols-[minmax(0,1fr)_minmax(0,42.5rem)] ${
          inShell ? '' : '@landing-split/landing:min-h-[calc(100svh-4.5rem)]'
        }`}
      >
        <div className="flex flex-col items-start gap-5">
          <p className="flex h-8 items-center rounded-full bg-accent-soft px-3.5 text-sm font-semibold text-accent-soft-fg">
            Для репетиторов английского и испанского
          </p>
          <h1 className="text-section font-bold text-fg @2xl/landing:text-headline @landing-wide/landing:text-headline-wide">
            Расписание, оплаты и домашка всех учеников&nbsp;— в одном месте.{' '}
            <span className="text-accent-strong">А материалы и разбор работ готовит AI.</span>
          </h1>
          <p className="max-w-130 text-lg leading-relaxed text-fg-secondary">
            Уроки, переносы, кто сколько оплатил и кому пора напомнить — всё в одном расписании. {fromPrice}, ученикам — бесплатно.
          </p>
          <div ref={heroCta} className="flex w-full flex-col items-start gap-2.5">
            <CTA className="w-full @md/landing:w-auto" />
            {!inShell && (
              <p className="text-sm text-fg-secondary">
                Уже есть аккаунт?{' '}
                <AppLink to="/login?role=teacher" className="font-medium text-accent-strong">
                  Войти
                </AppLink>
              </p>
            )}
          </div>
        </div>
        {/* одной колонкой — не шире 600, как в кадре; во всю ширину только на телефоне */}
        <ShotFrame title="Recall · Отчёт о занятиях за месяц" className="w-full max-w-150 @landing-split/landing:max-w-none">
          <ReportSample />
        </ShotFrame>
      </section>

      {/* ---- Что внутри (.ft8): восемь карточек, 4 × 2 ---- */}
      <section className={band(true)}>
        <h2 className={H2}>Что внутри</h2>
        <div className="grid gap-4 @xl/landing:grid-cols-2 @landing-split/landing:grid-cols-4">
          {INSIDE.map(({ Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-3 rounded-row bg-page p-5">
              <span className="flex size-11 items-center justify-center rounded-control-sm bg-accent-soft text-accent-strong">
                <Icon size={20} aria-hidden />
              </span>
              <p className="text-base font-semibold text-fg">{title}</p>
              <p className="text-sm leading-relaxed text-fg-secondary">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Между уроками (.two15): текст и телефон со снимком ---- */}
      <section className={band(false)}>
        <div className="grid items-center gap-10 @4xl/landing:grid-cols-[minmax(0,1fr)_21.25rem] @4xl/landing:gap-14">
          <div className="flex flex-col gap-5">
            <h2 className={H2}>Между уроками ученик не пропадает</h2>
            {BETWEEN_LESSONS.map((p) => (
              <p key={p} className="max-w-155 text-base leading-relaxed text-fg-secondary">
                {p}
              </p>
            ))}
          </div>
          <PhoneShot />
        </div>
      </section>

      {/* ---- Цены (.pr15) ---- */}
      <section className={band(true)}>
        <div className="flex flex-col gap-2">
          <h2 className={H2}>Цена зависит от числа учеников</h2>
          <p className="text-body text-fg-secondary">{fromPrice}. Ученикам — бесплатно.</p>
        </div>
        <PlanCards />
        <ReferralStrip text={REFERRAL} />
        <div>
          <CTA size="md" label="Начать пробный период" />
        </div>
      </section>

      {/* ---- Частые вопросы (.faq) ---- */}
      <section className={band(false)}>
        <h2 className={H2}>Частые вопросы</h2>
        <FaqList items={FAQ} />
      </section>

      {/* ---- Финал (.band15): фиолетовая плашка с белой кнопкой ---- */}
      <section className={`${PAD} pt-4`}>
        <div className="flex flex-col items-start gap-6 rounded-sheet bg-accent px-6 py-8 text-accent-fg @3xl/landing:flex-row @3xl/landing:items-center @3xl/landing:px-11 @3xl/landing:py-10">
          <div className="flex flex-1 flex-col gap-2">
            <h2 className="text-3xl font-bold">14 дней — достаточно, чтобы понять</h2>
            <p className="max-w-130 text-body leading-relaxed text-accent-fg">
              Заведите расписание, подключите одного ученика и назначьте ему материал. Через неделю будет видно, экономит ли Recall вам время. Если
              нет — просто не платите.
            </p>
          </div>
          <CTA inverse />
        </div>
      </section>

      {/* ---- Связь (.ct15): живой человек на другом конце решает больше, чем ещё один блок ---- */}
      <section className={`${PAD} flex flex-wrap items-center gap-x-5 gap-y-3 pb-6 pt-12`}>
        <h2 className="text-2xl font-semibold text-fg">Вопросы по проекту — напишите нам</h2>
        <ContactLinks icons subject="Recall — вопрос от преподавателя" />
        <p className="text-sm text-fg-muted">{SUPPORT_SLA}.</p>
      </section>

      {/* ---- Подвал (.foot15) ---- */}
      <footer className={`${PAD} flex flex-wrap items-center gap-x-6 border-t border-line pb-10 pt-4 text-sm text-fg-muted`}>
        <span>© Recall</span>
        <span className="flex-1" />
        <AppLink to="/terms" className={footLink}>
          Условия
        </AppLink>
        <AppLink to="/privacy" className={footLink}>
          Конфиденциальность
        </AppLink>
        <AppLink to="/pricing" className={footLink}>
          Все тарифы
        </AppLink>
      </footer>
    </Frame>
  )
}
