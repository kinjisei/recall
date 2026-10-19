// Три шага онбординга репетитора (макет t10-1…3). Телефон: вопрос сверху,
// выбор внизу, в зоне большого пальца (правило владельца, журнал п.71);
// компьютер: всё одним блоком по центру левой колонки (t10-4).
import { bandLabel, STUDENT_BANDS, type StudentBand } from '../../../domains/billing'
import { Button } from '../../../shared/ui/Button'
import { IconInfo } from '../../../shared/ui/icons'
import type { AppLang } from '../../../types'
import { Choice, HeardChips, Question } from './parts'

export const LANGS: { id: AppLang; label: string; native: string }[] = [
  { id: 'en', label: 'Английский', native: 'English' },
  { id: 'es', label: 'Испанский', native: 'Español' },
]

export function StepLang({ picked, onPick }: { picked: AppLang | null; onPick: (l: AppLang) => void }) {
  return (
    <>
      <Question
        title="Какой язык преподаёшь?"
        desc="Из него берутся слова и тексты для домашки. Поменять можно в любой момент."
      />
      <div className="mt-auto flex flex-col gap-2.5 lg:mt-4.5" role="group" aria-label="Язык, который преподаёшь">
        {LANGS.map((o) => (
          <Choice key={o.id} radio on={picked === o.id} onPick={() => onPick(o.id)}>
            {o.label}
            <small lang={o.id} className={`ml-auto text-sm font-medium ${picked === o.id ? 'text-accent-soft-fg' : 'text-fg-muted'}`}>
              {o.native}
            </small>
          </Choice>
        ))}
      </div>
    </>
  )
}

export function StepStudents({
  picked,
  trial,
  onPick,
  onPreview,
}: {
  picked: StudentBand | null
  /** Строка о пробном (bands.ts `trialLine`); null — не обещаем ничего. */
  trial: string | null
  onPick: (b: StudentBand) => void
  onPreview: (b: StudentBand | null) => void
}) {
  return (
    <>
      <Question title="Сколько у тебя учеников?" />
      {/* на компьютере та же строка — первым пунктом справа */}
      {trial && (
        <p className="mt-2.5 flex gap-2.5 rounded-2xl bg-accent-soft px-3.5 py-3 text-sm leading-[1.45] text-accent-soft-fg lg:hidden">
          <IconInfo size={18} className="mt-0.5 shrink-0" aria-hidden />
          {trial}
        </p>
      )}
      <div className="mt-auto grid grid-cols-2 gap-2.5 lg:mt-4.5" role="group" aria-label="Сколько учеников">
        {STUDENT_BANDS.map((b) => (
          <Choice
            key={b.id}
            center
            on={picked === b.id}
            onPick={() => onPick(b.id)}
            onPreview={(on) => onPreview(on ? b.id : null)}
          >
            {b.label}
          </Choice>
        ))}
      </div>
      <p className="mt-4.5 hidden text-base text-fg-secondary lg:block">Нажми вариант — сразу перейдём к последнему шагу</p>
    </>
  )
}

export function StepDone({
  lang,
  band,
  heard,
  onHeard,
  busy,
  error,
  onGo,
}: {
  lang: AppLang | null
  band: StudentBand | null
  heard: string | null
  onHeard: (v: string) => void
  busy: boolean
  error: string | null
  onGo: () => void
}) {
  const rows = [
    { label: 'Язык', value: LANGS.find((l) => l.id === lang)?.label ?? '—' },
    { label: 'Учеников', value: band ? bandLabel(band) : '—' },
  ]
  return (
    <>
      <div className="mt-10 flex flex-col gap-3 lg:mt-0">
        <h1 className="text-3xl font-bold leading-[1.18] tracking-[-0.02em] lg:text-4xl lg:leading-[1.15]">Студия готова</h1>
        <dl className="flex flex-col rounded-2xl bg-surface shadow-card">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex min-h-13 items-center gap-3 px-4 text-body ${i > 0 ? 'border-t border-line' : ''}`}>
              <dt className="flex-1 text-fg-secondary">{r.label}</dt>
              <dd className="font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-auto flex flex-col pb-4 pt-6 lg:mt-0 lg:pt-7">
        <HeardChips value={heard} onPick={onHeard} />
      </div>
      {error && <p className="mb-3 text-sm text-danger-strong">{error}</p>}
      <Button size="lg" onClick={onGo} loading={busy} className="w-full font-bold!">
        В студию
      </Button>
    </>
  )
}
