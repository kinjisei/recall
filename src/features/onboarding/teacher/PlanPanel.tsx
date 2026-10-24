// Правая колонка онбординга репетитора на компьютере (макет t10-4):
// «Подойдёт тариф» по ответу «Сколько учеников», ниже — что с пробным.
// Решения владельца (журнал п.73): справа всегда тариф — до ответа общая
// карточка, наведение на вариант показывает его тариф; «больше» — Pro и
// «напиши нам».
import { planOffer, trialLine, type StudentBand, type TrialOffer } from '../../../domains/billing'
import { ContactLinks } from '../../../shared/ui/ContactLinks'

export function PlanPanel({ band, offer }: { band: StudentBand | null; offer: TrialOffer }) {
  const card = planOffer(band, offer)
  const trial = trialLine(offer)
  const points = offer.kind === 'none' ? [] : [trial, 'Тариф выберешь позже — сейчас платить не нужно'].filter((p): p is string => !!p)
  return (
    <aside
      aria-label="Подойдёт тариф"
      className="hidden flex-col justify-center gap-4 border-l border-line bg-surface px-[clamp(3.5rem,15vw_-_8.5rem,5rem)] py-12 lg:flex"
    >
      <span className="text-note font-semibold uppercase tracking-[0.04em] text-fg-muted">Подойдёт тариф</span>
      <div aria-live="polite" className="flex max-w-105 flex-col gap-2.5 rounded-card bg-accent-soft p-5.5 text-accent-soft-fg">
        <b className="text-2xl font-bold">{card.title}</b>
        <span className="text-body leading-[1.45]">{card.students}</span>
        <span className="text-body leading-[1.45] opacity-90">{card.price}</span>
      </div>
      {card.overflow && (
        <div className="flex max-w-105 flex-col gap-2.5">
          <p className="text-body leading-[1.45] text-fg-secondary">Больше 30 учеников — напиши нам, подберём</p>
          <ContactLinks subject="Больше 30 учеников" />
        </div>
      )}
      {points.length > 0 && (
        <ol className="flex max-w-105 flex-col gap-2.5">
          {points.map((p, i) => (
            <li key={p} className="flex gap-3 text-body leading-[1.45] text-fg-secondary">
              <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-input text-note font-bold">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
