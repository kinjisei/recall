import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useCopy } from '../../shared/lib/useCopy'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { HintButton, HintPanel, useHint } from '../../shared/ui/HowItWorks'
import { IconPlus, IconRefresh } from '../../shared/ui/icons'
import { useOnReturn } from '../../shared/lib/useOnReturn'
import { HOW_IT_WORKS } from '../../data/howItWorks'
import {
  getOrCreateInviteCode,
  regenerateInviteCode,
  stopTeaching,
  getMyStudents,
  type StudentInfo,
} from '../../lib/teacher'
import { loadStudentCards, spacedCode, type StudentCard } from '../../domains/students'
import { GeneralInvite } from '../students'
import { StudentsTab } from './StudentsTab'
import { InnerScreenContext } from './innerScreen'
import { getHomeworkMany, type Homework } from '../../lib/homework'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { AppLink } from '../../shared/ui/AppLink'
import { LoadError } from '../../shared/ui/LoadError'
import { isConnectionError } from '../../shared/api/connection'

export function TeacherPage() {
  const { search } = useLocation()
  // «Материалы», «Письменные работы» и «Методичка» переехали во «Задания»
  // (PLAN.md Ф2.10): старые ссылки /teacher?tab=… ведут туда же, с открытым
  // материалом (?mat=) и прочим адресом
  if (new URLSearchParams(search).has('tab')) return <Navigate to={`/tasks${search}`} replace />
  return <StudentsScreen />
}

// «Ученики» — вкладка меню учителя (журнал п.35): список и карточки, общий
// код-приглашение, места тарифа. Кто сюда пускается — таблица маршрутов
// (роль teacher, app/routes.ts): не-репетитору — приглашение, без связи —
// «Повторить»; экран сам роль не проверяет.
//
// Шапка — одна строка «Ученики (?) [↻] [+ Ученик]» (Ф2.11б-2): пояснение
// значком, раскрыто при первом заходе; список сам перечитывается, когда
// учитель возвращается в приложение (useOnReturn), ↻ — когда хочется сейчас.
// Общий код под списком — строкой, всё остальное о нём — в «+ Ученик».
function StudentsScreen() {
  const [code, setCode] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
  // Карточки учеников (Ф2.5): все — и в приложении, и без него
  const [cards, setCards] = useState<StudentCard[]>([])
  // Домашки всех учеников одним запросом. Пустая карта — либо их нет, либо
  // запрос не прошёл: список обязан работать и без домашки, как раньше.
  const [homeworks, setHomeworks] = useState<Map<string, Homework | null>>(new Map())
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  // сбой загрузки — «Повторить», а не пустой список «учеников нет» (Ф1.13);
  // ошибка действия (сменить код, выключить режим) — отдельно, плашкой
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inner, setInner] = useState(false)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // шапки (и пояснения) нет, пока на телефоне открыта карточка
  const hint = useHint('teacher-students', !inner)

  // «Загрузка…» только при первом открытии: при обновлениях список остаётся
  // на экране, иначе раскрытые колоды учеников схлопываются при каждом действии.
  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [c, s, sc, hw] = await Promise.all([
        getOrCreateInviteCode(),
        getMyStudents(),
        loadStudentCards(),
        getHomeworkMany().catch(() => new Map<string, Homework | null>()),
      ])
      setCode(c)
      setStudents(s)
      setCards(sc)
      setHomeworks(hw)
      getMyPlan().then(setMyPlan).catch(() => {})
      setLoaded(true)
    } catch (e) {
      setLoadError(isConnectionError(e) || !(e instanceof Error) ? 'Не удалось загрузить учеников' : e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useOnReturn(() => void load())

  // ↻ крутится, пока идёт перечитывание: иначе нажатие выглядит как пустое
  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
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
    <InnerScreenContext.Provider value={setInner}>
      <div className="flex flex-col gap-4">
        {/* карточка на телефоне — экран со своим «‹ Ученики», шапка страницы над ней лишняя (t6-2) */}
        {!inner && (
          <div>
            <header className="flex items-center gap-1">
              <h1 className="text-2xl font-bold">Ученики</h1>
              <HintButton open={hint.open} onToggle={hint.toggle} />
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => void refresh()}
                aria-label="Обновить"
                title="Обновить"
                className="flex size-11 flex-none items-center justify-center rounded-full text-fg-muted hover:text-fg-secondary"
              >
                <IconRefresh size={20} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <Button className="min-h-11 px-4 py-2 text-sm" onClick={() => setAdding(true)} disabled={myPlan?.can_write === false}>
                <IconPlus size={18} /> Ученик
              </Button>
            </header>
            <HintPanel open={hint.open}>{HOW_IT_WORKS.teacher}</HintPanel>
          </div>
        )}

        {/* не загрузилось ни разу — только «Повторить»: пустой список сказал бы «учеников нет» */}
        {loadError && !loaded ? (
          <LoadError message={loadError} onRetry={load} />
        ) : (
          <StudentsTab
            cards={cards}
            students={students}
            homeworks={homeworks}
            plan={myPlan}
            loading={loading}
            adding={adding}
            onAddClose={() => setAdding(false)}
            generalInvite={<GeneralInvite code={code} regenerating={regenerating} onRegenerate={changeCode} />}
            onChanged={load}
            notice={
              loadError ? <LoadError message={loadError} onRetry={load} />
              : error && <Card tone="danger"><p className="text-sm text-danger-soft-fg">{error}</p></Card>
            }
            extras={
              <>
                {/* строка, а не блок: по высоте — как строка списка */}
                <Card className="py-2">
                  <CodeRow code={code} />
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
    </InnerScreenContext.Provider>
  )
}

/**
 * Общий код строкой под списком: продиктовать или скопировать. Что это за код,
 * сообщение с кнопками и «Сменить код» — в «+ Ученик → Пригласить по общему
 * коду» (GeneralInvite): нужно реже, чем список, и занимало пол-экрана.
 */
function CodeRow({ code }: { code: string | null }) {
  const { copied, copy } = useCopy()
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted" data-general-code={code ?? ''}>
      <span>
        Общий код:{' '}
        <span className="font-mono text-base font-bold tracking-widest text-fg">{code ? spacedCode(code) : '……'}</span>
      </span>
      <span aria-hidden>·</span>
      {/* нет доступа к буферу — код виден на экране, скопируют руками */}
      <button
        type="button"
        disabled={!code}
        onClick={() => code && void copy('invite', code)}
        className="-mx-1 min-h-11 rounded-lg px-1 font-semibold text-accent-strong"
      >
        {/* подтверждение «клюёт» — иначе подмена текста на секунду проходит
            мимо глаза, и человек жмёт второй раз */}
        <span key={copied ? 'yes' : 'no'} className={copied ? 'inline-block animate-pop-in' : ''}>
          {copied ? 'Скопирован ✓' : 'Скопировать'}
        </span>
      </button>
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
