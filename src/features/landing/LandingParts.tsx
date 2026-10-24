// ============================================================================
// Части лендинга /teachers (макет d15): кнопка на регистрацию, рамка
// браузера с примером отчёта, телефон со снимком Главной ученика, тарифы и
// вопросы гармошкой. Тарифы — из каталога domains/billing, а не своей
// копией: своя копия цен расходится с «Тарифами» и «Как оплатить».
// ============================================================================
import { useState, type ReactNode } from 'react'
import { AppLink } from '../../shared/ui/AppLink'
import { DisclosureIcon } from '../../shared/ui/Disclosure'
import { IconGift } from '../../shared/ui/icons'
import { Reveal } from '../../shared/ui/Reveal'
import { TEACHER_PLANS, planCard, planShortTitle } from '../../domains/billing'

const CTA_LOOK = {
  // первый экран и финал: 56, текст 18 (.cta15, .band15)
  lg: 'min-h-14 rounded-control px-6.5 text-lg font-semibold',
  // под тарифами: 52, текст 17 → 18 по шкале (.row15)
  md: 'min-h-13 rounded-control px-6 text-lg font-semibold',
  // в шапке после прокрутки: 44 (.lhd .b8p)
  sm: 'min-h-11 rounded-control-sm px-4 text-body font-semibold',
}

/** Главная кнопка — на регистрацию репетитора; `inverse` — белая на фиолетовой плашке финала. */
export function CTA({
  label = 'Попробовать 14 дней бесплатно',
  size = 'lg',
  inverse = false,
  className = '',
}: {
  label?: string
  size?: keyof typeof CTA_LOOK
  inverse?: boolean
  className?: string
}) {
  return (
    <AppLink
      to="/login?role=teacher"
      className={`lift inline-flex flex-none items-center justify-center whitespace-nowrap ${CTA_LOOK[size]} ${
        inverse ? 'bg-accent-fg font-bold text-accent' : 'bg-accent text-accent-fg'
      } ${className}`}
    >
      {label}
    </AppLink>
  )
}

/**
 * Пример отчёта родителям — «бумага», белая при любой теме (data-theme на
 * блоке). Стоит в рамке первого экрана до настоящего снимка отчёта (Ф2.20).
 * Комментарий в отчёте учитель пишет сам (teacher/ReportSheet), поэтому не
 * «собирается сам».
 */
export function ReportSample() {
  return (
    <div data-theme="light" className="w-full max-w-sm rounded-card border border-tint/[0.10] bg-surface p-4 text-left text-fg shadow-raised">
      <p className="text-micro uppercase tracking-widest text-fg-muted">Отчёт о занятиях · за месяц</p>
      <p className="font-serif text-lg font-bold">Айгерим</p>
      <div className="mt-2 flex flex-col gap-1 text-note">
        <p className="flex justify-between border-b border-line pb-1">
          <span>Дней с занятиями</span>
          <span className="font-semibold">
            18 <span className="text-success-strong">▲ 6</span>
          </span>
        </p>
        <p className="flex justify-between border-b border-line pb-1">
          <span>Средний балл заданий</span>
          <span className="font-semibold">
            84% <span className="text-success-strong">▲ 12%</span>
          </span>
        </p>
        <p className="flex justify-between">
          <span>Выучено слов</span>
          <span className="font-semibold">47</span>
        </p>
      </div>
      <p className="mt-2 text-caption text-fg-muted">Цифры — из занятий ученика, комментарий — ваш. Родители видят, за что платят.</p>
    </div>
  )
}

/** Рамка окна браузера (.shot): полоса с тремя точками и подписью, внутри — экран 16 : 10. */
export function ShotFrame({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`m-0 flex flex-col overflow-hidden rounded-control bg-surface shadow-raised ring-1 ring-line ${className}`} data-landing-shot>
      <div className="flex h-7.5 flex-none items-center gap-1.5 bg-input px-3" aria-hidden>
        <i className="size-2.5 rounded-full bg-line" />
        <i className="size-2.5 rounded-full bg-line" />
        <i className="size-2.5 rounded-full bg-line" />
        <span className="ml-3 text-caption text-fg-muted">{title}</span>
      </div>
      <div className="flex aspect-[16/10] items-center justify-center bg-page p-6">{children}</div>
    </figure>
  )
}

/** Телефон (.phshot) с настоящим снимком Главной ученика — `scripts/shot-landing-phone.mjs`. */
export function PhoneShot() {
  return (
    <div className="mx-auto h-125 w-62.5 overflow-hidden rounded-device bg-surface shadow-raised ring-8 ring-fg">
      <img
        src="/landing/student-home.webp"
        width={250}
        height={541}
        loading="lazy"
        decoding="async"
        alt="Главная ученика в Recall: ближайший урок, домашка на неделю, «Начать занятие» и серия дней"
        className="block w-full object-cover object-top"
      />
    </div>
  )
}

/** Тариф, с которого советуем начать. Это наша рекомендация, а не «выбор большинства»: статистики выборов нет. */
const ADVISED = 'teacher_start'

const TEACHER_CARDS = TEACHER_PLANS.map(planCard)

/** Самый дешёвый тариф репетитора — для «От 3 900 ₸ в месяц». */
export const MIN_TEACHER_PRICE = Math.min(...TEACHER_CARDS.map((p) => p.price))

/** Тарифы в ряд (.pr15): советуемый — подложкой акцента, рамкой и меткой на краю. */
export function PlanCards() {
  return (
    <div className="grid gap-4 @2xl/landing:grid-cols-3">
      {TEACHER_CARDS.map((p) => {
        const hot = p.id === ADVISED
        const seats = p.studentLimit ?? 1
        const tone = hot ? 'text-accent-soft-fg' : 'text-fg-secondary'
        return (
          <div
            key={p.id}
            className={`relative flex flex-col gap-3 rounded-card p-6 ${hot ? 'mt-3 bg-accent-soft inset-ring-2 inset-ring-focus @2xl/landing:mt-0' : 'bg-page'}`}
            data-plan={p.id}
          >
            {hot && (
              <span className="absolute -top-3.25 left-6 rounded-full bg-accent px-3 py-1 text-note font-semibold text-accent-fg">
                Советуем начать с него
              </span>
            )}
            <h3 className={`text-xl font-semibold ${hot ? 'text-accent-soft-fg' : 'text-fg'}`}>{planShortTitle(p.id)}</h3>
            <p className={`text-section font-bold leading-none tabular-nums ${hot ? 'text-accent-soft-fg' : 'text-fg'}`}>
              {p.price.toLocaleString('ru-RU')} ₸<small className={`text-body font-medium ${tone}`}>/мес</small>
            </p>
            <p className={`text-body ${tone}`}>до {seats} учеников</p>
            <p className={`text-body font-medium ${hot ? 'text-accent-soft-fg' : 'text-accent-strong'}`}>
              {Math.round(p.price / seats).toLocaleString('ru-RU')} ₸ за ученика
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** Строка «пригласите коллегу» (.inv15): подарок и текст. */
export function ReferralStrip({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-3 rounded-control bg-page px-4.5 py-3.5 text-body text-fg-secondary">
      <IconGift size={20} aria-hidden className="mt-0.5 flex-none text-accent-strong" />
      {text}
    </p>
  )
}

/** «Частые вопросы» гармошкой (.faq): первый открыт, остальные — по нажатию. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="flex max-w-205 flex-col rounded-row bg-surface shadow-card" data-faq>
      {items.map((f, i) => (
        <div key={f.q} className={i ? 'border-t border-line' : undefined}>
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            className="flex min-h-14 w-full items-center gap-3 px-5 py-4 text-left text-base font-medium text-fg"
          >
            <span className="flex-1">{f.q}</span>
            <DisclosureIcon open={open === i} className="text-fg-muted" />
          </button>
          <Reveal open={open === i}>
            <p className="px-5 pb-4.5 text-body leading-relaxed text-fg-secondary">{f.a}</p>
          </Reveal>
        </div>
      ))}
    </div>
  )
}
