// ============================================================================
// Онбординг репетитора по макету t10 (PLAN.md Ф2.11б-4, журнал п.71, 73):
// язык → «Сколько у тебя учеников?» → «Студия готова» с «Откуда ты о нас
// знаешь?» и «В студию» (стартовый экран учителя — расписание).
//
// Полоски шагов без текста заполняются по ответам. Выбор сразу ведёт дальше:
// вариант подсвечивается 120 мс, сегмент заполняется, экран уезжает влево
// (240 мс); «Назад» возвращает с сохранённым и подсвеченным выбором. На
// первом шаге «Назад» есть только у того, кто свернул сюда сам («Я
// преподаватель» у ученика), — с лендинга путь уже выбран.
//
// Язык — не формальность: пока у студии нет своего переключателя (PLAN.md
// Ф3.6), язык домашки берётся из EN/ES в шапке. Это настройка устройства,
// поэтому на новом устройстве репетитор видит этот экран ещё раз — отсюда
// пробный по правилу базы (bands.ts), а не «14 дней» всем.
// Ответ «Сколько учеников» — событие teacher_students: сводка владельцу в
// /admin (admin_onboarding_answers, миграция 0013), тариф — справа.
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { teacherTrialOffer, trialLine, type StudentBand, type TrialOffer } from '../../../domains/billing'
import { track } from '../../../lib/analytics'
import { getMyPlan } from '../../../lib/billing'
import { becomeTeacher } from '../../../lib/teacher'
import { BrandMark } from '../../../shared/ui/Brand'
import { IconChevronLeft } from '../../../shared/ui/icons'
import type { AppLang } from '../../../types'
import { BackLink, StepBars } from './parts'
import { PlanPanel } from './PlanPanel'
import { StepDone, StepLang, StepStudents } from './steps'

/** Подсветка выбранного варианта до смены шага (макет t10-1). */
const PICK_MS = 120
/** Заполнение сегмента — дождаться его перед уходом в студию. */
const FILL_MS = 320

export function TeacherOnboarding({
  enable,
  onBack,
  onDone,
}: {
  /** Включить режим преподавателя по «В студию» — если он ещё не включён. */
  enable: boolean
  /** Есть, если на этот путь свернули сами («Я преподаватель» на первом шаге). */
  onBack?: () => void
  onDone: (band: StudentBand | null) => void
}) {
  const { setLang } = useLanguage()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<'next' | 'back' | null>(null)
  const [lang, setPickedLang] = useState<AppLang | null>(null)
  const [band, setBand] = useState<StudentBand | null>(null)
  const [preview, setPreview] = useState<StudentBand | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<TrialOffer>(() => teacherTrialOffer(!enable, null))
  const timer = useRef<number | undefined>(undefined)

  // пробный — из базы; не прочиталось (нет связи) — обычные 14 дней, шагам это не мешает
  useEffect(() => {
    if (enable) return
    let alive = true
    void getMyPlan().then((plan) => alive && setOffer(teacherTrialOffer(true, plan)))
    return () => {
      alive = false
    }
  }, [enable])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const choose = (apply: () => void) => {
    if (advancing) return
    apply()
    setAdvancing(true)
    timer.current = window.setTimeout(() => {
      setDir('next')
      setStep((s) => s + 1)
      setPreview(null)
      setAdvancing(false)
    }, PICK_MS)
  }

  const back =
    step > 0
      ? () => {
          setDir('back')
          setStep(step - 1)
          setPreview(null)
        }
      : onBack

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      // Повторное включение безвредно (become_teacher идемпотентна) и несёт
      // код коллеги, если автоматическое включение после входа сорвалось.
      if (enable) await becomeTeacher()
      // последний сегмент заполняется — и только потом в студию
      setStep(3)
      timer.current = window.setTimeout(() => onDone(band), FILL_MS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось включить режим преподавателя')
      setBusy(false)
    }
  }

  // Поля колонок на компьютере — по кадрам t10-4: 56 px при 1280 и 80 при 1440,
  // между ними плавно (clamp в классах ниже и в PlanPanel). Двумя точками
  // перехода (lg: и «от 1440») не вышло: lg шёл в CSS позже и перебивал.
  const shown = Math.min(step, 2)
  const filled = step + (advancing ? 1 : 0)
  const slide = dir === 'next' ? 'animate-[vt-in-right_240ms_cubic-bezier(0.2,0,0,1)_both]' : dir === 'back' ? 'animate-[vt-in-left_240ms_cubic-bezier(0.2,0,0,1)_both]' : ''

  return (
    <main className="min-h-[100dvh] bg-page text-fg lg:grid lg:grid-cols-2">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-screen-sm flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] lg:mx-0 lg:max-w-none lg:px-[clamp(3.5rem,15vw_-_8.5rem,5rem)] lg:pb-12 lg:pt-7">
        <div className="-mx-2 flex h-13 shrink-0 items-center gap-2 lg:mx-0 lg:h-12 lg:gap-3">
          <button
            type="button"
            onClick={back}
            aria-label="Назад"
            aria-hidden={!back}
            tabIndex={back ? 0 : -1}
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-accent-strong lg:hidden ${back ? '' : 'invisible'}`}
          >
            <IconChevronLeft size={24} />
          </button>
          <span className="hidden items-center gap-2.5 text-lg font-semibold lg:flex">
            <span aria-hidden>
              <BrandMark size={30} />
            </span>
            Recall
          </span>
          <StepBars step={shown} filled={filled} />
        </div>

        <div key={shown} className={`flex flex-1 flex-col lg:my-auto lg:w-full lg:max-w-120 lg:flex-none lg:px-4 ${slide}`}>
          {back && <BackLink onClick={back} />}
          {shown === 0 && (
            <StepLang
              picked={lang}
              onPick={(l) =>
                choose(() => {
                  setLang(l)
                  setPickedLang(l)
                })
              }
            />
          )}
          {shown === 1 && (
            <StepStudents
              picked={band}
              trial={trialLine(offer)}
              onPreview={setPreview}
              onPick={(b) =>
                choose(() => {
                  setBand(b)
                  void track('teacher_students', { value: b })
                })
              }
            />
          )}
          {shown === 2 && <StepDone lang={lang} band={band} heard={heard} onHeard={setHeard} busy={busy} error={error} onGo={go} />}
        </div>
      </section>
      <PlanPanel band={preview ?? band} offer={offer} />
    </main>
  )
}
