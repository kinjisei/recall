// ============================================================================
// Онбординг репетитора (PLAN.md Ф2.11) — один экран вместо вопросов ученика:
// какой язык преподаёт и как узнал о Recall, затем — в студию (стартовый
// экран учителя — расписание, где пустое состояние ведёт к первому ученику и
// первому уроку, макет t2-4).
//
// Язык — не формальность: пока у студии нет своего переключателя (PLAN.md
// Ф3.6), язык домашки берётся из EN/ES в шапке. Учитель испанского без этого
// вопроса задал бы первую домашку с английскими словами. Язык — настройка
// устройства, поэтому на новом устройстве репетитор видит этот экран ещё раз.
// ============================================================================
import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { becomeTeacher } from '../../lib/teacher'
import { Button } from '../../shared/ui/Button'
import type { AppLang } from '../../types'
import { Heading, HowHeard, ONBOARDING_CTA } from './parts'

const LANGS: { id: AppLang; label: string; desc: string }[] = [
  { id: 'en', label: 'EN', desc: 'Английский' },
  { id: 'es', label: 'ES', desc: 'Испанский' },
]

/** «От коллеги» вместо «От преподавателя»; репетиторов владелец находит и звонком. */
const HOW_HEARD_TEACHER = ['Инстаграм', 'TikTok', 'Телеграм', 'От коллеги', 'Звонок от Recall', 'Поиск', 'Другое']

export function StepTeacher({
  enable,
  onBack,
  onDone,
}: {
  /** Включить режим преподавателя по кнопке — если он ещё не включён. */
  enable: boolean
  /** Есть, если на этот путь свернули сами («Я преподаватель» на первом шаге). */
  onBack?: () => void
  onDone: () => void
}) {
  const { lang, setLang } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      // Повторное включение безвредно (become_teacher идемпотентна) и несёт
      // код коллеги, если автоматическое включение после входа сорвалось.
      if (enable) await becomeTeacher()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось включить режим преподавателя')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <Heading
        title="Какой язык преподаёшь?"
        desc="Из него берутся слова и тексты для домашки. Поменять можно в любой момент."
      />
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Язык, который преподаёшь">
        {LANGS.map((o, i) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={lang === o.id}
            onClick={() => setLang(o.id)}
            className={`lift animate-fade-up flex flex-col items-center justify-center gap-2 rounded-3xl border py-6 ${
              lang === o.id
                ? 'border-accent-line bg-accent-soft text-accent-soft-fg'
                : 'border-tint/[0.08] bg-surface shadow-card'
            }`}
            style={{ animationDelay: `${0.05 + i * 0.08}s` }}
          >
            <span className="text-2xl font-medium">{o.label}</span>
            <span className="text-body font-medium">{o.desc}</span>
          </button>
        ))}
      </div>

      <HowHeard options={HOW_HEARD_TEACHER} />

      <div className="mt-auto flex flex-col gap-3">
        {error && <p className="text-sm text-danger-strong">{error}</p>}
        <Button onClick={start} loading={busy} className={`py-4 ${ONBOARDING_CTA}`}>
          В студию
        </Button>
        {onBack && (
          <button onClick={onBack} className="min-h-11 py-1 text-sm text-fg-muted">
            Назад
          </button>
        )}
      </div>
    </div>
  )
}
