import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUrlState } from '../../shared/lib/useUrlState'
import { useCopy } from '../../shared/lib/useCopy'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { HowItWorks } from '../../shared/ui/HowItWorks'
import { HOW_IT_WORKS } from '../../data/howItWorks'
import { loadProfile } from '../../lib/profile'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { LoadError } from '../../shared/ui/LoadError'
import { useAuth } from '../../context/AuthContext'
import {
  getOrCreateInviteCode,
  regenerateInviteCode,
  stopTeaching,
  getMyStudents,
  type StudentInfo,
} from '../../lib/teacher'
import { loadStudentCards, type StudentCard } from '../../domains/students'
import { MaterialsSection } from './MaterialsSection'
import { WritingSection } from './WritingSection'
import { GuideSection } from './GuideSection'
import { StudentsTab } from './StudentsTab'
import { BecomeTeacher } from './BecomeTeacher'
import { StudioEnergy } from './StudioEnergy'
import { StudioTabs, type TeacherTab } from './StudioTabs'
import { getHomeworkMany, type Homework } from '../../lib/homework'
import { countSubmittedWorks } from '../../lib/materials'
import { countSubmittedWriting } from '../../lib/writing'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { AppLink } from '../../shared/ui/AppLink'
import { Loading } from '../../shared/ui/Loading'

export function TeacherPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Кэш профиля — Главная и меню аватара уже запрашивали тот же ряд. Сбой связи —
  // плашка, а не «Включи режим преподавателя» настоящему учителю (Ф1.13).
  const { data: profile, error, loading, reload } = useAsyncData(
    () => (user ? loadProfile(user.id) : Promise.resolve(null)),
    [user],
    'Не удалось открыть студию',
  )

  if (error) return <LoadError message={error} onRetry={reload} />
  if (loading) return <Loading label="Открываем студию" />

  if (profile?.role !== 'teacher') {
    return <BecomeTeacher onDone={reload} onBack={() => navigate('/')} />
  }

  return <TeacherDashboard />
}

function TeacherDashboard() {
  // вкладка — в адресе: «назад» из «Методички» уводил на Главную, а не на
  // предыдущую вкладку (замер ревью 1Г); заодно на вкладку можно дать ссылку
  const [rawTab, setRawTab] = useUrlState('tab', (v) =>
    ['materials', 'writing', 'guide'].includes(v),
  )
  const tab = (rawTab as TeacherTab | null) ?? 'students'
  const setTab = (t: TeacherTab) => setRawTab(t === 'students' ? null : t)
  const [code, setCode] = useState<string | null>(null)
  const { copied, copy } = useCopy()
  const [regenerating, setRegenerating] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
  // Карточки учеников (Ф2.5): все — и в приложении, и без него
  const [cards, setCards] = useState<StudentCard[]>([])
  // Домашки всех учеников одним запросом. Пустая карта — либо их нет, либо
  // запрос не прошёл: список обязан работать и без домашки, как раньше.
  const [homeworks, setHomeworks] = useState<Map<string, Homework | null>>(new Map())
  const [pendingWorks, setPendingWorks] = useState(0)
  const [pendingWriting, setPendingWriting] = useState(0)
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // «Загрузка…» только при первом открытии: при обновлениях список остаётся
  // на экране, иначе раскрытые колоды учеников схлопываются при каждом действии.
  const load = useCallback(async () => {
    setError(null)
    try {
      const [c, s, sc, pending, pendingW, hw] = await Promise.all([
        getOrCreateInviteCode(),
        getMyStudents(),
        loadStudentCards(),
        countSubmittedWorks().catch(() => 0), // был отдельным шагом ПОСЛЕ Promise.all
        countSubmittedWriting().catch(() => 0),
        getHomeworkMany().catch(() => new Map<string, Homework | null>()),
      ])
      setCode(c)
      setStudents(s)
      setCards(sc)
      setHomeworks(hw)
      setPendingWorks(pending)
      setPendingWriting(pendingW)
      getMyPlan().then(setMyPlan).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // нет доступа к буферу — код виден на экране, скопируют руками
  const copyCode = () => {
    if (code) void copy('invite', code)
  }

  // Перевыпуск кода: старый сразу перестаёт работать, уже привязанные ученики
  // остаются. Спрашиваем подтверждение — действие необратимое.
  // Выключение режима: возвращает обычную роль. Учеников не трогает — если они
  // есть, база откажет с понятным текстом (кнопку в этом случае и не показываем).
  const stopTeach = async () => {
    if (!confirm('Выключить режим преподавателя? Студия и код приглашения пропадут. Твои собственные занятия останутся как есть.')) return
    setStopping(true)
    setError(null)
    try {
      await stopTeaching()
      // жёсткий переход, а не navigate: роль читают шапка, меню и Главная —
      // после смены роли проще перезагрузить приложение, чем ловить их все
      window.location.assign('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось выключить')
    } finally {
      setStopping(false)
    }
  }

  const changeCode = async () => {
    if (!confirm('Выдать новый код? Старый перестанет работать сразу. Уже привязанные ученики останутся.')) {
      return
    }
    setRegenerating(true)
    setError(null)
    try {
      setCode(await regenerateInviteCode())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить код')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Преподаватель</h1>
        {tab === 'students' && (
          <Button variant="ghost" className="px-3 py-1 text-sm" onClick={load}>
            Обновить
          </Button>
        )}
      </header>

      <HowItWorks>{HOW_IT_WORKS.teacher}</HowItWorks>

      <StudioTabs tab={tab} onTab={setTab} pendingWorks={pendingWorks} pendingWriting={pendingWriting} />

      {tab === 'guide' ? (
        <GuideSection />
      ) : tab === 'writing' ? (
        <WritingSection students={students} />
      ) : tab === 'materials' ? (
        // onWorksChanged: после проверки/переназначения пересчитываем бейдж
        // «На проверку» на вкладке — иначе он висел старым числом до «Обновить»
        <MaterialsSection
          students={students}
          onWorksChanged={() => countSubmittedWorks().then(setPendingWorks)}
        />
      ) : (
        <StudentsTab
          cards={cards}
          students={students}
          homeworks={homeworks}
          plan={myPlan}
          loading={loading}
          onChanged={load}
          notice={error && <Card tone="danger"><p className="text-sm text-danger-soft-fg">{error}</p></Card>}
          extras={
            <>
              {myPlan && typeof myPlan.energy_max === 'number' && !myPlan.is_admin && myPlan.in_studio && (
                <StudioEnergy plan={myPlan} />
              )}
              <Card>
                <p className="text-sm text-fg-muted">
                  Общий код — ученик вводит его у себя на Главной и появляется в списке.
                  Пригласить того, кто уже есть в списке, — из его карточки.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="rounded-xl bg-tint/[0.08] px-4 py-2 font-mono text-2xl font-bold tracking-widest">
                    {code ?? '……'}
                  </span>
                  <Button variant="secondary" className="px-3 py-2 text-sm" onClick={copyCode}>
                    {/* подтверждение «клюёт» — иначе подмена текста на секунду
                        проходит мимо глаза, и человек жмёт второй раз */}
                    <span key={copied ? 'yes' : 'no'} className={copied ? 'animate-pop-in' : ''}>
                      {copied ? 'Скопирован ✓' : 'Скопировать'}
                    </span>
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    className="min-h-[44px] px-3 py-2 text-sm"
                    loading={regenerating}
                    onClick={changeCode}
                  >
                    Сменить код
                  </Button>
                  <span className="text-xs text-fg-muted">
                    если код попал не тем — старый перестанет работать
                  </span>
                </div>
                <Seats plan={myPlan} inApp={students.length} />

                {/* Включить режим можно было одним нажатием, а выключить — никак:
                    нажавший из любопытства оставался с чужой ролью навсегда.
                    Показываем только когда учеников нет — с ними выключение всё
                    равно откажет, и кнопка-обманка была бы хуже её отсутствия;
                    с карточками — студией явно пользуются. */}
                {students.length === 0 && cards.length === 0 && (
                  <div className="mt-3 border-t border-tint/[0.06] pt-3">
                    <Button
                      variant="ghost"
                      className="min-h-[44px] px-3 py-2 text-sm text-fg-muted"
                      loading={stopping}
                      onClick={stopTeach}
                    >
                      Выключить режим преподавателя
                    </Button>
                  </div>
                )}
              </Card>
            </>
          }
        />
      )}
    </div>
  )
}

/**
 * Места тарифа под кодом-приглашением: что значит «без ограничения» и что
 * делать, когда места кончились. Сколько занято — тихой строкой над списком
 * (features/students), счёт — база (get_my_plan.seats_used: только ученики в
 * приложении «занимается» и «пауза»). Молчит у админа и у не-преподавателя.
 */
function Seats({ plan, inApp }: { plan: MyPlan | null; inApp: number }) {
  // seats нет в ответе — миграция не залита; 0 — не преподаватель; админ без лимитов
  if (!plan || plan.seats === undefined || plan.seats === 0 || plan.is_admin) return null
  const total = plan.seats // null = без ограничения

  if (total === null) {
    return (
      <div className="mt-3 border-t border-tint/[0.06] pt-3">
        <p className="text-xs text-fg-muted">
          В приложении учеников: <span className="text-fg-secondary">{inApp}</span> · приглашать
          можно сколько нужно
        </p>
        <p className="mt-1.5 text-xs text-fg-muted">
          Сейчас у каждого ученика обычный бесплатный запас AI. Общий запас на всю студию и
          генерация материалов —{' '}
          <AppLink to="/pricing" className="text-accent underline underline-offset-2">
            на тарифе для преподавателей
          </AppLink>
          .
        </p>
      </div>
    )
  }

  if ((plan.seats_used ?? 0) < total) return null
  const onTrialSeats = typeof plan.free_seats === 'number' && total === plan.free_seats
  return (
    <p className="mt-3 border-t border-tint/[0.06] pt-3 text-xs text-fg-secondary">
      {onTrialSeats
        ? `Пока идёт пробный период, в приложении можно вести до ${total} учеников — зато у каждого повышенный запас AI. Чтобы взять больше — `
        : 'Места тарифа заняты. Чтобы пригласить в приложение ещё — '}
      <AppLink to="/pricing" className="text-accent underline underline-offset-2">
        подключи тариф
      </AppLink>
      . Пробные ученики и карточки без приложения мест не занимают.
    </p>
  )
}
