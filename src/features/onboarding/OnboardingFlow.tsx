// ============================================================================
// Онбординг нового пользователя (роут /onboarding). Ученик — 3 шага:
//   1) какой язык учим (пишет recall.lang),
//   2) уровень: тест (есть для обоих языков) ИЛИ для EN ещё и выбор вручную;
//      шаг можно пропустить,
//   3) «Твой план готов» + конфетти и запуск первой ведомой сессии.
// Репетитор — один экран (StepTeacher, PLAN.md Ф2.11): пришёл по ссылке
// /login?role=teacher, режим уже включён или выбрал «Я преподаватель» на
// первом шаге. Вопросы ученика ему не задаём.
// Показывается только новичку: см. shouldOnboard в lib/onboarding.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconBadgeCheck,
  IconGap,
  IconMic,
  IconCards,
  type IconLike,
} from '../../shared/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../shared/api/supabase'
import { joinTeacher } from '../../lib/teacher'
import { hasPendingTeacherRole, pendingJoin } from '../../lib/pendingRole'
import { getProfile, invalidateProfile } from '../../lib/profile'
import { setEsLevel } from '../../lib/esLevel'
import { markOnboarded } from '../../lib/onboarding'
import { startGuidedRoute } from '../../lib/guided'
import { track } from '../../lib/analytics'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { celebrate } from '../../shared/ui/Confetti'
import { Button } from '../../shared/ui/Button'
import { GOAL_LABELS, type AppLang, type CEFRLevel, type LearningGoal } from '../../types'
import { Heading, HowHeard, ONBOARDING_CTA } from './parts'
import { StepTeacher } from './StepTeacher'

// A1 добавлен: profiles.level и тест уровня теперь допускают его (новичок с нуля)
const EN_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']

/** Варианты ответа «как узнал» — короткие, чтобы влезали в один-два ряда чипов. */
const HOW_HEARD = ['Инстаграм', 'TikTok', 'Телеграм', 'От преподавателя', 'Друзья', 'Поиск', 'Другое']

export function OnboardingFlow() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, setLang } = useLanguage()
  // Репетитор ли это. Метку из ссылки снимает включение режима сразу после
  // входа (ProtectedRoute), поэтому запоминаем её на старте экрана, а после —
  // смотрим роль в профиле. Пока не выяснили — пустой экран, а не вопросы
  // ученика на миг.
  const [fromLanding] = useState(hasPendingTeacherRole)
  const { data: profile, loading } = useAsyncData(
    () => (user ? getProfile(user.id) : Promise.resolve(null)),
    [user?.id],
  )
  const [picked, setPicked] = useState<boolean | null>(null)
  const teacher = picked ?? (fromLanding || profile?.role === 'teacher')
  const deciding = picked === null && !fromLanding && loading
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

  const finishTeacher = () => {
    // онбординг считаем пройденным, иначе ProtectedRoute вернёт сюда же
    markOnboarded()
    void track('onboarding_done', { lang, role: 'teacher' })
    // стартовый экран роли выбирает каркас (StartGate): учителя «/» уводит в расписание
    navigate('/', { replace: true })
  }

  const frame = 'mx-auto flex min-h-[100dvh] max-w-screen-sm flex-col gap-7 bg-page px-5 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)] text-fg'
  if (deciding) return <main className={frame} />
  if (teacher) {
    return (
      <main className={frame}>
        <StepTeacher
          enable={profile?.role !== 'teacher'}
          onBack={picked ? () => setPicked(false) : undefined}
          onDone={finishTeacher}
        />
      </main>
    )
  }

  return (
    <main className={frame}>
      {/* прогресс из трёх сегментов */}
      <div className="flex gap-2" aria-label={`Шаг ${step + 1} из 3`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= step ? 'bg-accent' : 'bg-tint/[0.09]'
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
          onTeacher={() => setPicked(true)}
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
        <StepReady lang={lang} level={level} onFinish={finish} />
      )}
    </main>
  )
}

// --- Шаг 1: язык -----------------------------------------------------------

function StepLanguage({ onPick, onTeacher }: { onPick: (l: AppLang) => void; onTeacher: () => void }) {
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
            className="lift animate-fade-up flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-tint/[0.08] bg-surface shadow-card"
            style={{ animationDelay: `${0.05 + i * 0.08}s` }}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-2xl font-medium text-accent-soft-fg">
              {o.label}
            </span>
            <span className="text-[15px] font-medium">{o.desc}</span>
          </button>
        ))}
      </div>
      {/* Развилка — на первом шаге: репетитору вопросы ученика не нужны (Ф2.11) */}
      <button
        onClick={onTeacher}
        className="min-h-11 self-center py-1 text-sm text-fg-muted underline underline-offset-4"
      >
        Я преподаватель — веду своих учеников
      </button>
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
        <p className="text-sm text-fg-secondary">Зачем тебе язык?</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABELS) as LearningGoal[]).map((g) => (
            <button
              key={g}
              onClick={() => onGoal(g)}
              className={`min-h-11 rounded-full px-3.5 text-sm transition-colors ${
                goal === g
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'bg-tint/[0.06] text-fg-secondary'
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
        className="lift animate-fade-up rounded-2xl border border-accent-line bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] px-4 py-4 text-left"
      >
        <span className="block text-[15px] font-medium">
          Пройти тест · до {lang === 'es' ? 40 : 50} вопросов
        </span>
        <span className="block text-[13px] text-fg-muted">
          ~5 минут, результат сразу
        </span>
      </button>

      {lang === 'en' && (
        <>
          <p className="text-center text-xs text-fg-muted">или выбери сам</p>
          <div className="grid grid-cols-2 gap-3">
            {EN_LEVELS.map((l, i) => (
              <button
                key={l}
                onClick={() => onPick(l)}
                className={`lift animate-fade-up rounded-2xl border px-4 py-4 text-left ${
                  level === l
                    ? 'border-accent-line bg-[rgba(145,132,217,.16)]'
                    : 'border-tint/[0.08] bg-surface'
                }`}
                style={{ animationDelay: `${0.05 + i * 0.06}s` }}
              >
                <span className="block text-lg font-medium">{l}</span>
                <span className="block text-[12px] text-fg-muted">
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
          <p className="text-center text-sm text-fg-muted">
            Выбери уровень — или нажми «Не знаю», подберём сами.
          </p>
        )}
        <Button onClick={onNext} disabled={lang === 'en' && !level} className={`h-13 py-3.5 ${ONBOARDING_CTA}`}>
          Дальше
        </Button>
        <button
          onClick={onSkip}
          className="h-13 rounded-2xl border border-tint/[0.12] py-3.5 font-medium text-fg-secondary transition-[filter,transform] active:scale-[0.98]"
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
}: {
  lang: AppLang
  level: CEFRLevel | null
  onFinish: () => void
}) {
  // Развилка «сам / с преподавателем»: у кого есть преподаватель — вводит код тут же,
  // чтобы не искать, куда его вводить потом; по ссылке-приглашению (Ф2.5) код уже в поле.
  const [showCode, setShowCode] = useState(() => pendingJoin() !== null)
  const [code, setCode] = useState(() => pendingJoin() ?? '')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const joinAndFinish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || joining) return
    setJoining(true)
    setJoinError(null)
    try {
      await joinTeacher(code.trim())
      onFinish() // привязались — дальше как обычно; задания даст преподаватель
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Не удалось привязаться')
      setJoining(false)
    }
  }
  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <IconBadgeCheck
          size={64}
          className="animate-pop-in text-accent"
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
            className="animate-fade-up flex items-center gap-3.5 rounded-2xl border border-tint/[0.08] bg-surface px-4 py-3.5 shadow-card"
            style={{ animationDelay: `${0.1 + i * 0.09}s` }}
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
              <p.Icon size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">{p.title}</span>
              <span className="text-[13px] text-fg-muted">{p.desc}</span>
            </span>
          </div>
        ))}
      </div>

      <HowHeard options={HOW_HEARD} />

      <div className="mt-auto flex flex-col gap-3">
        {!showCode ? (
          <>
            <Button onClick={onFinish} className={`py-4 ${ONBOARDING_CTA}`}>
              Занимаюсь сам — начать
            </Button>
            <button
              onClick={() => setShowCode(true)}
              className="rounded-2xl border border-tint/[0.12] py-3.5 font-medium text-fg-secondary transition-[filter,transform] active:scale-[0.98]"
            >
              У меня есть преподаватель
            </button>
          </>
        ) : (
          <form onSubmit={joinAndFinish} className="flex flex-col gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код от преподавателя"
              autoFocus
              className="h-12 rounded-2xl border border-tint/[0.12] bg-input px-4 text-center text-lg tracking-widest outline-none focus:border-accent-line"
            />
            {joinError && <p className="text-sm text-danger-strong">{joinError}</p>}
            <Button type="submit" disabled={!code.trim() || joining} className={`py-4 ${ONBOARDING_CTA}`}>
              {joining ? 'Привязываю…' : 'Привязаться и начать'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowCode(false)
                setJoinError(null)
              }}
              className="min-h-[44px] py-1 text-sm text-fg-muted"
            >
              Назад
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
