// ============================================================================
// Онбординг нового пользователя (роут /onboarding): 3 шага —
//   1) какой язык учим (пишет recall.lang),
//   2) уровень: тест (есть для обоих языков) ИЛИ для EN ещё и выбор вручную;
//      шаг можно пропустить,
//   3) «Твой план готов» + конфетти и запуск первой ведомой сессии.
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
import { invalidateProfile } from '../../lib/profile'
import { setEsLevel } from '../../lib/esLevel'
import { markOnboarded } from '../../lib/onboarding'
import { startGuidedRoute } from '../../lib/guided'
import { track, setSelfReportedSource } from '../../lib/analytics'
import { celebrate } from '../../components/Confetti'
import { GOAL_LABELS, type AppLang, type CEFRLevel, type LearningGoal } from '../../types'

// A1 добавлен: profiles.level и тест уровня теперь допускают его (новичок с нуля)
const EN_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

/** Варианты ответа «как узнал» — короткие, чтобы влезали в один-два ряда чипов. */
const HOW_HEARD = ['Инстаграм', 'TikTok', 'Телеграм', 'От преподавателя', 'Друзья', 'Поиск', 'Другое']

export function OnboardingFlow() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang } = useLanguage()
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<CEFRLevel | null>(null)
  // Зачем человек учит язык. Спрашиваем на том же шаге, что и уровень: это
  // родственные вопросы, а удлинять онбординг четвёртым экраном не хочется —
  // короткий путь до первого занятия важнее полноты анкеты.
  const [goal, setGoal] = useState<LearningGoal | null>(null)

  // Уровень английского храним в профиле, испанского — локально; цель всегда
  // в профиле (она не зависит от языка и нужна преподавателю).
  const saveLevel = async () => {
    if (lang === 'es' && level) setEsLevel(level)
    if (!user) return
    const patch: { level?: CEFRLevel; goal?: LearningGoal } = {}
    if (level && lang === 'en') patch.level = level
    if (goal) patch.goal = goal
    if (Object.keys(patch).length === 0) return
    // supabase-js не бросает на ошибке — берём её из ответа. Если запись не
    // удалась, не инвалидируем кэш зря, но пользователя не держим: онбординг
    // всё равно завершаем (всё это можно задать позже в «Настройках»).
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (!error) invalidateProfile()
  }

  const finish = async () => {
    await saveLevel()
    void track('onboarding_done', { lang, level, goal })
    markOnboarded()
    celebrate()
    // «Начать первое занятие» — сразу ведомая сессия. Куда именно вести,
    // выясняем ЗАРАНЕЕ (startGuidedRoute), пока идёт празднование: у новичка
    // слов нет, и он должен попасть на чтение сразу, а не смотреть на хаб,
    // который через пять секунд сам сменится (замер ревью 1А).
    const route = startGuidedRoute(lang)
    setTimeout(() => void route.then((r) => navigate(r, { replace: true })), 600)
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
          goal={goal}
          onGoal={setGoal}
          onPick={setLevel}
          onSkip={() => setStep(2)}
          onNext={() => setStep(2)}
          onPlacement={() => navigate('/placement')}
        />
      )}

      {step === 2 && (
        <StepReady
          lang={lang}
          level={level}
          onFinish={finish}
          onTeacher={async () => {
            // онбординг считаем пройденным, иначе ProtectedRoute вернёт сюда же
            await saveLevel()
            markOnboarded()
            navigate('/teacher', { replace: true })
          }}
        />
      )}
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
  goal,
  onGoal,
  onPick,
  onSkip,
  onNext,
  onPlacement,
}: {
  lang: AppLang
  level: CEFRLevel | null
  goal: LearningGoal | null
  onGoal: (g: LearningGoal) => void
  onPick: (l: CEFRLevel) => void
  onSkip: () => void
  onNext: () => void
  onPlacement: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Heading
        title="Определим уровень"
        desc="Короткий тест подстроит тексты, подсказки и «Диалог» — или выбери уровень сам."
      />

      {/* Зачем человек учит язык. Раньше не спрашивали вовсе — а у школьника,
          у готовящегося к IELTS и у того, кто учит «для себя», это разные
          занятия. Цель видна преподавателю и уходит в подсказки AI.
          Спрашиваем ПЕРВЫМ: ответить на неё легче, чем оценить свой уровень. */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-[var(--night-text-70)]">Зачем тебе язык?</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABELS) as LearningGoal[]).map((g) => (
            <button
              key={g}
              onClick={() => onGoal(g)}
              className={`min-h-11 rounded-full px-3.5 text-sm transition-colors ${
                goal === g
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.06] text-[var(--night-text-70)]'
              }`}
            >
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Тест уровня доступен для ОБОИХ языков (EN-тест теперь есть). Ниже — для
          EN ещё и ручной выбор, чтобы не заставлять новичка проходить тест. */}
      <button
        onClick={onPlacement}
        className="lift animate-fade-up rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] px-4 py-4 text-left"
      >
        <span className="block text-[15px] font-medium">
          Пройти тест · до {lang === 'es' ? 40 : 50} вопросов
        </span>
        <span className="block text-[13px] text-[var(--night-text-40)]">
          ~5 минут, результат сразу
        </span>
      </button>

      {lang === 'en' && (
        <>
          <p className="text-center text-xs text-[var(--night-text-40)]">или выбери сам</p>
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
                  {l === 'A1'
                    ? 'только начинаю'
                    : l === 'A2'
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
        </>
      )}

      {/* Раньше главная кнопка была серой и неактивной, пока уровень не выбран,
          без единого слова о том, чего от человека ждут, — а выход («Пропустить»)
          был мельче тупика. Получалось наоборот: сломанным выглядело нужное
          действие. Теперь есть подпись, а «Не знаю» — полноценная вторая кнопка:
          не знать свой уровень нормально, мы его и так определим по ходу. */}
      <div className="mt-auto flex flex-col gap-3">
        {lang === 'en' && !level && (
          <p className="text-center text-sm text-[var(--night-text-40)]">
            Выбери уровень — или нажми «Не знаю», подберём сами.
          </p>
        )}
        <button
          onClick={onNext}
          disabled={lang === 'en' && !level}
          className="h-13 rounded-2xl bg-[var(--night-text)] py-3.5 font-medium text-[var(--night-bg)] transition-[filter,transform] active:scale-[0.98] disabled:opacity-40"
        >
          Дальше
        </button>
        <button
          onClick={onSkip}
          className="h-13 rounded-2xl border border-white/[0.12] py-3.5 font-medium text-[var(--night-text-70)] transition-[filter,transform] active:scale-[0.98]"
        >
          Не знаю свой уровень
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
  onTeacher,
}: {
  lang: AppLang
  level: CEFRLevel | null
  onFinish: () => void
  onTeacher: () => void
}) {
  const [heard, setHeard] = useState<string | null>(null)
  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <IconBadgeCheck
          size={64}
          className="animate-pop-in text-[var(--night-accent)]"
        />
        {/* «Твой план готов» звучало как персональная подборка, а порядок
            здесь у всех один и от уровня не зависит — обещание без механизма
            (находка ревью 2В). Честнее назвать то, что есть: первый заход. */}
        <Heading
          title="С чего начнём"
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

      {/* «Как узнал» — единственный источник, который переживает пересылку
          ссылки без параметров (а в телеграме и вотсапе так пересылают почти
          всегда) и ловит сарафан, которого метки не видят вовсе.
          Отдельным шагом делать не стал: это налог на всех ради одной строки. */}
      <div className="flex flex-col gap-2.5">
        <p className="text-sm text-[var(--night-text-40)]">Как ты о нас узнал?</p>
        <div className="flex flex-wrap gap-2">
          {HOW_HEARD.map((h) => (
            <button
              key={h}
              onClick={() => {
                setHeard(h)
                setSelfReportedSource(h)
              }}
              className={`min-h-11 rounded-xl border px-3.5 py-2 text-sm ${
                heard === h
                  ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.16)]'
                  : 'border-white/[0.08] bg-[var(--night-surface)] text-[var(--night-text-70)]'
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={onFinish}
          className="rounded-2xl bg-[var(--night-text)] py-4 font-medium text-[var(--night-bg)] transition-[filter,transform] active:scale-[0.98]"
        >
          Начать первое занятие
        </button>
        {/* вход для репетитора: раньше роль выдавалась только вручную в базе,
            и человек, пришедший вести учеников, не находил студию вообще */}
        <button
          onClick={onTeacher}
          className="min-h-[44px] py-1 text-sm text-[var(--night-text-40)] underline underline-offset-4"
        >
          Я преподаватель — веду своих учеников
        </button>
      </div>
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
