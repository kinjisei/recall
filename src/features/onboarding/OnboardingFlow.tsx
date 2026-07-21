// ============================================================================
// Онбординг нового пользователя (роут /onboarding): 3 шага —
//   1) какой язык учим (пишет recall.lang),
//   2) уровень: для ES — существующий placement-тест, для EN — выбор вручную
//      (теста EN пока нет); шаг можно пропустить,
//   3) «Твой план готов» + конфетти и переход на Главную.
// Показывается только новичку: см. useIsNewUser ниже.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconBadgeCheck,
  IconGap,
  IconMic,
  IconCards,
  type IconLike,
} from '../../components/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { setEsLevel } from '../../lib/esLevel'
import { markOnboarded } from '../../lib/onboarding'
import { celebrate } from '../../components/Confetti'
import type { AppLang, CEFRLevel } from '../../types'

const EN_LEVELS: CEFRLevel[] = ['A2', 'B1', 'B2', 'C1']

export function OnboardingFlow() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang } = useLanguage()
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<CEFRLevel | null>(null)

  const finish = async () => {
    // уровень английского храним в профиле, испанского — локально
    if (level) {
      if (lang === 'es') setEsLevel(level)
      else if (user) {
        await supabase.from('profiles').update({ level }).eq('id', user.id).then(
          () => {},
          () => {},
        )
      }
    }
    markOnboarded()
    celebrate()
    setTimeout(() => navigate('/', { replace: true }), 600)
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-screen-sm flex-col gap-7 bg-[var(--night-bg)] px-5 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)] text-[var(--night-text)]">
      {/* прогресс из трёх сегментов */}
      <div className="flex gap-2" aria-label={`Шаг ${step + 1} из 3`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= step ? 'bg-[var(--night-accent)]' : 'bg-white/[0.09]'
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <StepLanguage
          onPick={(l) => {
            setLang(l)
            setLevel(null)
            setStep(1)
          }}
        />
      )}

      {step === 1 && (
        <StepLevel
          lang={lang}
          level={level}
          onPick={setLevel}
          onSkip={() => setStep(2)}
          onNext={() => setStep(2)}
          onPlacement={() => navigate('/placement')}
        />
      )}

      {step === 2 && <StepReady lang={lang} level={level} onFinish={finish} />}
    </main>
  )
}

// --- Шаг 1: язык -----------------------------------------------------------

function StepLanguage({ onPick }: { onPick: (l: AppLang) => void }) {
  const options: { id: AppLang; label: string; desc: string }[] = [
    { id: 'en', label: 'EN', desc: 'Английский' },
    { id: 'es', label: 'ES', desc: 'Испанский' },
  ]
  return (
    <div className="flex flex-col gap-6">
      <Heading title="Что будем учить?" desc="Язык можно поменять в любой момент в шапке." />
      <div className="grid grid-cols-2 gap-3">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="lift animate-fade-up flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-white/[0.08] bg-[var(--night-surface)]"
            style={{ animationDelay: `${0.05 + i * 0.08}s` }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--night-accent-900)] text-2xl font-medium text-[var(--night-accent-100)]">
              {o.label}
            </span>
            <span className="text-[15px] font-medium">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Шаг 2: уровень --------------------------------------------------------

function StepLevel({
  lang,
  level,
  onPick,
  onSkip,
  onNext,
  onPlacement,
}: {
  lang: AppLang
  level: CEFRLevel | null
  onPick: (l: CEFRLevel) => void
  onSkip: () => void
  onNext: () => void
  onPlacement: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Определим уровень"
        desc={
          lang === 'es'
            ? 'Короткий тест подстроит подсказки и «Диалог» под тебя.'
            : 'Выбери свой уровень — подстроим тексты и задания.'
        }
      />

      {lang === 'es' ? (
        <button
          onClick={onPlacement}
          className="lift animate-fade-up rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] px-4 py-4 text-left"
        >
          <span className="block text-[15px] font-medium">Пройти тест · до 40 вопросов</span>
          <span className="block text-[13px] text-[var(--night-text-40)]">
            ~5 минут, результат сразу
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {EN_LEVELS.map((l, i) => (
            <button
              key={l}
              onClick={() => onPick(l)}
              className={`lift animate-fade-up rounded-2xl border px-4 py-4 text-left ${
                level === l
                  ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.16)]'
                  : 'border-white/[0.08] bg-[var(--night-surface)]'
              }`}
              style={{ animationDelay: `${0.05 + i * 0.06}s` }}
            >
              <span className="block text-lg font-medium">{l}</span>
              <span className="block text-[12px] text-[var(--night-text-40)]">
                {l === 'A2'
                  ? 'базовые фразы'
                  : l === 'B1'
                    ? 'общаюсь с трудом'
                    : l === 'B2'
                      ? 'уверенно, но с ошибками'
                      : 'свободно'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={onNext}
          disabled={lang === 'en' && !level}
          className="h-13 rounded-2xl bg-[var(--night-text)] py-3.5 font-medium text-[var(--night-bg)] transition-[filter,transform] active:scale-[0.98] disabled:opacity-40"
        >
          Дальше
        </button>
        <button onClick={onSkip} className="py-1 text-sm text-[var(--night-text-40)]">
          Пропустить
        </button>
      </div>
    </div>
  )
}

// --- Шаг 3: план готов -----------------------------------------------------

const PLAN: { Icon: IconLike; title: string; desc: string }[] = [
  { Icon: IconCards, title: 'Слова', desc: 'карточки и мини-игры' },
  { Icon: IconGap, title: 'Чтение', desc: 'тексты с разбором слов' },
  { Icon: IconMic, title: 'Речь', desc: 'произношение вслух' },
]

function StepReady({
  lang,
  level,
  onFinish,
}: {
  lang: AppLang
  level: CEFRLevel | null
  onFinish: () => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <IconBadgeCheck
          size={64}
          className="animate-pop-in text-[var(--night-accent)]"
        />
        <Heading
          title="Твой план готов"
          desc={`${lang === 'es' ? 'Испанский' : 'Английский'}${level ? ` · ${level}` : ''} · ~15 минут в день`}
          center
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {PLAN.map((p, i) => (
          <div
            key={p.title}
            className="animate-fade-up flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] px-4 py-3.5"
            style={{ animationDelay: `${0.1 + i * 0.09}s` }}
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
              <p.Icon size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">{p.title}</span>
              <span className="text-[13px] text-[var(--night-text-40)]">{p.desc}</span>
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        className="mt-auto rounded-2xl bg-[var(--night-text)] py-4 font-medium text-[var(--night-bg)] transition-[filter,transform] active:scale-[0.98]"
      >
        Начать первое занятие
      </button>
    </div>
  )
}

function Heading({
  title,
  desc,
  center = false,
}: {
  title: string
  desc: string
  center?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 ${center ? 'items-center text-center' : ''}`}>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="text-sm text-[var(--night-text-40)]">{desc}</p>
    </div>
  )
}
