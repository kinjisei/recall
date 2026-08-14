import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconGraduation, IconFlame, IconBadgeCheck } from '../../components/icons'
import { BackHeader } from '../../components/BackButton'
import { GOAL_LABELS } from '../../types'
import { useUrlState } from '../../lib/useUrlState'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getProfile } from '../../lib/profile'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import {
  getOrCreateInviteCode,
  regenerateInviteCode,
  becomeTeacher,
  stopTeaching,
  setStudentSeat,
  unlinkStudent,
  getMyStudents,
  type StudentInfo,
} from '../../lib/teacher'
import { MaterialsSection } from './MaterialsSection'
import { WritingSection } from './WritingSection'
import { StudentWordsSection } from './StudentWordsSection'
import { QuestSection } from './QuestSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { GuideSection } from './GuideSection'
import { DailyPlanSection } from './DailyPlanSection'
import { HomeworkSection, StatTiles } from './HomeworkSection'
import { HomeworkComposer } from './HomeworkComposer'
import { getHomeworkMany, type Homework } from '../../lib/homework'
import {
  byAttention,
  needAttention,
  studentSignal,
  type StudentSignal,
} from '../../lib/studentSignals'
import { Reveal } from '../../components/Reveal'
import { getStudentDiagnostics, type StudentDiagnostics } from '../../lib/diagnostics'
import { countSubmittedWorks } from '../../lib/materials'
import { countSubmittedWriting } from '../../lib/writing'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { IconSparkle } from '../../components/icons'
import type { Profile } from '../../types'
import { AppLink } from '../../components/AppLink'
import { Loading, RowsSkeleton } from '../../components/Loading'

export function TeacherPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!user) return
    // кэш профиля — Главная и меню аватара уже запрашивали тот же ряд
    getProfile(user.id).then((p) => {
      setProfile(p)
      setLoading(false)
    })
  }, [user])

  useEffect(reload, [reload])

  if (loading) return <Loading label="Открываем студию" />

  if (profile?.role !== 'teacher') {
    return <BecomeTeacher onDone={reload} onBack={() => navigate('/')} />
  }

  return <TeacherDashboard />
}

// --- Включение режима преподавателя ----------------------------------------
// Раньше здесь стояла заглушка «попроси владельца включить роль в SQL Editor» —
// то есть репетитор, пришедший сам, не мог начать вообще (A1 в docs/mkt/19-fix-plan).

const TEACHER_PERKS = [
  'Привязываешь учеников по коду — они занимаются, ты видишь результат',
  'AI проверяет письменные работы, ты правишь вердикт, если не согласен',
  'Карта ошибок ученика: какие слова не держатся, какие темы валит',
  'Отчёт родителям на печать — в одну кнопку',
]

function BecomeTeacher({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // число бесплатных мест живёт в БД (free_teacher_seats) — здесь только показываем
  const [freeSeats, setFreeSeats] = useState<number | null>(null)

  useEffect(() => {
    getMyPlan().then((p) => setFreeSeats(p?.free_seats ?? null))
  }, [])

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await becomeTeacher()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось включить режим')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title="Преподаватель" label="На главную" />
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
            <IconGraduation size={22} />
          </span>
          <div>
            <h2 className="text-[17px] font-medium">Ведёшь учеников?</h2>
            <p className="mt-1 text-sm text-[var(--night-text-70)]">
              Включи режим преподавателя — появится своя студия с кодом-приглашением.
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {TEACHER_PERKS.map((p) => (
            <li key={p} className="flex gap-2.5 text-sm text-[var(--night-text-70)]">
              <IconBadgeCheck size={17} className="mt-0.5 flex-none text-[var(--night-accent)]" />
              {p}
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

        <Button className="mt-5 w-full" onClick={enable} loading={busy}>
          Включить режим преподавателя
        </Button>
        <p className="mt-3 text-center text-xs text-[var(--night-text-40)]">
          Включается бесплатно и ничего не меняет в твоих собственных занятиях.
          Общий запас AI для студии и генерация материалов появляются, когда
          привяжешь первого ученика
          {freeSeats ? ` (на пробном периоде их до ${freeSeats})` : ''}.
        </p>
      </Card>
    </div>
  )
}

type TeacherTab = 'students' | 'materials' | 'writing' | 'guide'

function TeacherDashboard() {
  // вкладка — в адресе: «назад» из «Методички» уводил на Главную, а не на
  // предыдущую вкладку (замер ревью 1Г); заодно на вкладку можно дать ссылку
  const [rawTab, setRawTab] = useUrlState('tab', (v) =>
    ['materials', 'writing', 'guide'].includes(v),
  )
  // Открытый ученик — в адресе. Замер 09.08: карточка со всеми разделами
  // занимает ~700px, и пятеро учеников превращали список в 3.9 экрана и
  // ТРИДЦАТЬ раскрывашек; на тарифе с десятью было бы семь экранов и
  // шестьдесят. Список должен оставаться списком, а разделы — открываться
  // отдельным экраном (заодно на ученика можно дать ссылку).
  const [openStudent, setOpenStudent] = useUrlState('student')
  const tab = (rawTab as TeacherTab | null) ?? 'students'
  const setTab = (t: TeacherTab) => setRawTab(t === 'students' ? null : t)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
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
      const [c, s, pending, pendingW, hw] = await Promise.all([
        getOrCreateInviteCode(),
        getMyStudents(),
        countSubmittedWorks().catch(() => 0), // был отдельным шагом ПОСЛЕ Promise.all
        countSubmittedWriting().catch(() => 0),
        getHomeworkMany().catch(() => new Map<string, Homework | null>()),
      ])
      setCode(c)
      setStudents(s)
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

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* нет доступа к буферу — код виден на экране */
    }
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
      setCopied(false)
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

      {/* Перенос строки, а не горизонтальная прокрутка. Замер ревью 1В: ряду
          из четырёх вкладок нужно 415px, а на iPhone 12 доступно 348 — четвёртая
          («Методичка») уезжала за край, прокрутки у контейнера не было, и
          добраться до неё можно было только сдвигая вбок всю страницу. Скрытая
          прокрутка лечила бы обрезку, но не саму проблему: человек по-прежнему
          не знает, что там есть ещё вкладка. Перенос показывает все четыре. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['students', 'Ученики'],
            ['materials', 'Материалы'],
            // «Письмо» читалось как «сообщение ученику», хотя это задания-эссе
            // с проверкой по критериям IELTS — то есть самый сильный довод
            // студии прятался за названием (находка ревью 1В). У ученика этот
            // же раздел уже называется «Письменные задания» — теперь совпадает.
            ['writing', 'Письменные работы'],
            ['guide', 'Методичка'],
          ] as [TeacherTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === id
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {label}
            {id === 'materials' && pendingWorks > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-amber-950">
                {pendingWorks}
              </span>
            )}
            {id === 'writing' && pendingWriting > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-amber-950">
                {pendingWriting}
              </span>
            )}
          </button>
        ))}
      </div>

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
        <>
          {myPlan && typeof myPlan.energy_max === 'number' && !myPlan.is_admin && myPlan.in_studio && (
            <StudioEnergy plan={myPlan} />
          )}
          <Card>
            <p className="text-sm text-[var(--night-text-40)]">
              Код-приглашение — ученик вводит его у себя на Главной:
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded-xl bg-white/[0.08] px-4 py-2 font-mono text-2xl font-bold tracking-widest">
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
              <span className="text-xs text-[var(--night-text-40)]">
                если код попал не тем — старый перестанет работать
              </span>
            </div>
            <Seats plan={myPlan} used={students.length} />

            {/* Включить режим можно было одним нажатием, а выключить — никак:
                нажавший из любопытства оставался с чужой ролью навсегда.
                Показываем только когда учеников нет — с ними выключение всё
                равно откажет, и кнопка-обманка была бы хуже её отсутствия. */}
            {students.length === 0 && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <Button
                  variant="ghost"
                  className="min-h-[44px] px-3 py-2 text-sm text-[var(--night-text-40)]"
                  loading={stopping}
                  onClick={stopTeach}
                >
                  Выключить режим преподавателя
                </Button>
              </div>
            )}
          </Card>

          {error && (
            <Card className="border-red-300 bg-red-950/30">
              <p className="text-sm text-red-300">{error}</p>
            </Card>
          )}

          {loading ? (
            <RowsSkeleton count={3} />
          ) : students.length === 0 ? (
            <Card className="text-center">
              <IconGraduation size={40} className="mx-auto block text-[var(--night-text-40)]" />
              <p className="mt-2 font-semibold">Пока ни одного ученика</p>
              <p className="mt-1 text-sm text-[var(--night-text-40)]">
                Отправь код-приглашение — после ввода кода ученик появится здесь.
                Тогда же включатся общий запас AI для студии и генерация материалов.
              </p>
            </Card>
          ) : (
            <>
            {/* Сводка вверху списка: без неё пропавшего надо было ВЫСМАТРИВАТЬ
                среди всех — при пяти учениках упражнение на внимательность,
                при десяти лотерея. Порядок списка НЕ трогаем: по нему считается,
                кто попадает в места тарифа (первые N по дате привязки). */}
            {(() => {
              // ⚠️ Покрытие тарифом считаем ДО сортировки и по ИСХОДНОМУ
              // порядку привязки: пока мест никто не выбирал, их держат первые N
              // по дате (так же считает covering_teacher в БД). Отсортируй
              // сначала — и значок «вне мест тарифа» уедет не на тех людей.
              const rows = students.map((s, i) => ({
                student: s,
                signal: studentSignal(s, homeworks.get(s.profile.id) ?? null),
                covered:
                  typeof myPlan?.seats !== 'number'
                    ? true
                    : students.some((x) => x.seat)
                      ? s.seat
                      : i < myPlan.seats,
              }))
              const attention = needAttention(rows.map((r) => r.signal))
              // Сортируем ПОКАЗ, а не данные: сперва те, к кому надо вернуться.
              const shown = byAttention(rows, (r) => r.signal)
              const lostRows = rows.filter((r) => r.signal.lost)

              return (
                <>
                  {attention > 0 && (
                    <Card className="border-amber-300/40 bg-amber-400/[0.06]">
                      <p className="text-sm font-semibold text-amber-200">
                        Нужно внимание: {attention}
                      </p>
                      <p className="mt-1 text-sm text-[var(--night-text-70)]">
                        {shown
                          .filter(
                            (r) =>
                              r.signal.attention === 'overdue' || r.signal.attention === 'lost',
                          )
                          .map(
                            (r) =>
                              `${r.student.profile.display_name ?? 'Без имени'} — ${
                                r.signal.overdue ? 'домашка просрочена' : lastSeen(r.student)
                              }`,
                          )
                          .join(' · ')}
                      </p>
                      <p className="mt-2 text-xs text-[var(--night-text-40)]">
                        {lostRows.length > 0
                          ? 'Неделя без занятий — обычно момент, когда стоит написать самому.'
                          : 'Срок домашки прошёл, а сделано не всё.'}
                      </p>
                    </Card>
                  )}
                  {shown.map((r) =>
                    openStudent === r.student.profile.id ? (
                      <StudentCard
                        key={r.student.profile.id}
                        student={r.student}
                        onChanged={load}
                        covered={r.covered}
                        seatsKnown={typeof myPlan?.seats === 'number'}
                        onBack={() => setOpenStudent(null)}
                      />
                    ) : openStudent ? null : (
                      <StudentRow
                        key={r.student.profile.id}
                        student={r.student}
                        signal={r.signal}
                        covered={r.covered}
                        seatsKnown={typeof myPlan?.seats === 'number'}
                        onOpen={() => setOpenStudent(r.student.profile.id)}
                      />
                    ),
                  )}
                </>
              )
            })()}
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Человеческий срок последнего занятия. */
function lastSeen(s: StudentInfo): string {
  const d = s.daysSinceActive
  if (d === null) return 'ещё не начинал'
  if (d === 0) return 'занимался сегодня'
  if (d === 1) return 'был вчера'
  return `не заходил ${d} ${d < 5 ? 'дня' : 'дней'}`
}

/**
 * Строка ученика в списке. Показывает ровно то, что нужно, чтобы выбрать, кем
 * заняться: имя, уровень, цель и серия. Всё остальное — за тапом.
 *
 * Раньше каждый ученик разворачивался в карточку с шестью раскрывашками прямо
 * в списке: пятеро давали 3.9 экрана прокрутки и тридцать одинаковых строк-
 * переключателей, и выбрать взглядом было невозможно (замер 09.08).
 */
function StudentRow({
  student,
  signal,
  covered,
  seatsKnown,
  onOpen,
}: {
  student: StudentInfo
  /** Числа строки — те же, что в карточке (см. lib/studentSignals). */
  signal: StudentSignal
  covered: boolean
  seatsKnown: boolean
  onOpen: () => void
}) {
  const p = student.profile
  return (
    <button onClick={onOpen} className="text-left">
      <Card interactive className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{p.display_name ?? 'Без имени'}</span>

          {/* Домашка — первое, что нужно перед уроком: «3 из 5 · до вторника».
              Раньше её тут не было вовсе, и ответ на главный вопрос требовал
              открыть карточку каждого. */}
          {signal.homeworkText ? (
            <span
              className={`block truncate text-sm ${
                signal.overdue ? 'text-amber-200' : 'text-[var(--night-text-70)]'
              }`}
            >
              {signal.homeworkText} · {signal.dueText}
            </span>
          ) : (
            <span className="block truncate text-sm text-[var(--night-text-40)]">
              Домашка не выдана
            </span>
          )}

          <span className="block truncate text-sm text-[var(--night-text-40)]">
            {p.level ? `Уровень ${p.level}` : 'Уровень не определён'}
            {p.goal ? ` · ${GOAL_LABELS[p.goal]}` : ''}
          </span>

          {/* ⚠️ Регулярность, а не объём. «120 карточек» — это один просиженный
              вечер, «занимался 5 дней из 7» — привычка; для прогресса частота
              значит больше суммы. Стрик оставляем рядом: он про то же, но
              обнуляется от одного пропуска и в одиночку молчит о пропавшем. */}
          <span className="mt-0.5 block text-sm text-[var(--night-text-40)]">
            <IconFlame size={13} className="inline align-text-bottom" /> {student.streak} ·
            занимался {signal.regularity} ·{' '}
            <span className={signal.lost ? 'text-amber-200' : ''}>{lastSeen(student)}</span>
          </span>

          {seatsKnown && !covered && (
            <span className="mt-1 inline-block rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
              Вне мест тарифа
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-medium text-[var(--night-accent-text)]">›</span>
      </Card>
    </button>
  )
}

/**
 * Разделы под «Ещё» — то, что нужно раз в месяц. Порядок значим: тест уровня
 * первым, потому что с нового ученика начинают именно с него (это и в
 * методичке, и в комментариях кода стояло всегда, а на экране — нет).
 */
const SECTIONS = [
  { id: 'placement', title: 'Тест уровня' },
  { id: 'diag', title: 'Диагностическая карта' },
  { id: 'plan', title: 'План дня' },
  { id: 'program', title: 'Программа обучения' },
  { id: 'words', title: 'Слова и перепроверка' },
  { id: 'quests', title: 'AI-квесты по грамматике' },
] as const

type StudentSection = (typeof SECTIONS)[number]['id']

function StudentCard({
  student,
  onChanged,
  covered = true,
  seatsKnown = false,
  onBack,
}: {
  student: StudentInfo
  onChanged: () => void
  /** Возврат к списку учеников (карточка теперь отдельный экран). */
  onBack?: () => void
  /** Покрыт ли ученик тарифом: сверх мест AI-возможности у него обычные, бесплатные. */
  covered?: boolean
  /** Есть ли вообще ограничение мест (на тарифе без лимита переключать нечего). */
  seatsKnown?: boolean
}) {
  const { lang: appLang } = useLanguage()
  const [seatBusy, setSeatBusy] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = student.profile

  // ⚠️ Раскрытый раздел живёт в АДРЕСЕ, как на остальных 12 экранах: в PWA
  // свайп-назад — единственный способ вернуться, и без этого он выбрасывал бы
  // из карточки целиком вместо закрытия раздела. Пять отдельных булевых
  // состояний заменены одним: открыт максимум один раздел, и это же чинит
  // старую беду — раскрытые подряд диагностика с программой давали экран,
  // который невозможно пролистать.
  const [rawSection, setRawSection] = useUrlState('sec', (v) =>
    SECTIONS.some((s) => s.id === v),
  )
  const section = rawSection as StudentSection | null
  const setSection = (v: StudentSection | null) => setRawSection(v)
  const [more, setMore] = useState(!!section)
  const [composing, setComposing] = useState(false)
  /** Растёт после выдачи домашки — блок перечитывает себя, карточка не мигает. */
  const [hwVersion, setHwVersion] = useState(0)

  // Числа для плашек берём из ОБЩЕЙ диагностики (lib/diagnostics), а не считаем
  // рядом: второй счёт разошёлся бы с картой молча, и учитель увидел бы в
  // карточке одно, а в разделе — другое.
  const [diag, setDiag] = useState<StudentDiagnostics | null>(null)
  const [diagLoading, setDiagLoading] = useState(true)
  useEffect(() => {
    let alive = true
    setDiag(null)
    setDiagLoading(true)
    getStudentDiagnostics(p.id)
      .then((d) => alive && setDiag(d))
      .catch(() => {
        /* карточка из-за плашек падать не должна: покажем «—» вместо чисел */
      })
      .finally(() => alive && setDiagLoading(false))
    return () => {
      alive = false
    }
  }, [p.id])


  return (
    <div className="flex flex-col gap-3">
      {/* Карточка ученика стала отдельным экраном — значит нужен возврат
          к списку (общий BackHeader, как на всех внутренних экранах). */}
      {onBack && <BackHeader onBack={onBack} title={p.display_name ?? 'Ученик'} label="К списку" />}
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{p.display_name ?? 'Без имени'}</p>
          <p className="text-sm text-[var(--night-text-40)]">
            {/* Уровня может НЕ БЫТЬ: пока ученик не прошёл тест, мы его не
                знаем. Раньше здесь стояло «Уровень B1» (умолчание колонки), и
                карточка противоречила строке ниже — «тестов пока не было». */}
            {p.level ? `Уровень ${p.level}` : 'Уровень не определён'} ·{' '}
            <IconFlame size={13} className="inline align-text-bottom" />{' '}
            {student.streak} ·{' '}
            {student.doneToday ? 'сегодня ✓' : 'сегодня —'}
          </p>
          {/* Цель ученика — то, ради чего он вообще пришёл. Преподавателю она
              нужна раньше любых цифр: у готовящегося к IELTS и у школьника
              занятия строятся по-разному. */}
          {p.goal && (
            <p className="mt-0.5 text-sm text-[var(--night-accent-text)]">
              Цель: {GOAL_LABELS[p.goal]}
            </p>
          )}
          {seatsKnown && !covered && (
            <p className="mt-1 inline-block rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
              Вне мест тарифа — занимается на бесплатных лимитах AI
            </p>
          )}
        </div>
        <p className="text-right text-sm text-[var(--night-text-40)]">
          за 7 дней:
          <br />
          <span className="text-lg font-bold text-[var(--night-text-70)]">
            {student.weekItems}
          </span>{' '}
          заданий
        </p>
      </div>

      {/* 1. Домашка — первой: это единственное, что нужно и до урока, и после.
             Раздел «Наборы слов» убран (2026-08-10), выдача слов живёт в
             «Словах» — там виден весь словарь ученика со статусами. */}
      <HomeworkSection
        studentId={p.id}
        reloadKey={hwVersion}
        onCompose={() => setComposing(true)}
      />

      {/* 2. Три числа, за которыми преподаватель и приходит. */}
      <StatTiles
        diag={
          diag
            ? {
                struggling: diag.words.struggling.length,
                weakTopics: diag.mistakes.length,
                // ⚠️ Ровно то же число, что в строке списка (activeDays7):
                // две цифры про одно и то же на соседних экранах обесценивают
                // друг друга. activeDays14 остаётся для промптов AI.
                activeDays: diag.activeDays7,
              }
            : null
        }
        loading={diagLoading}
      />

      {/* 3. Всё остальное — под «Ещё». Оно нужно раз в месяц, а занимало весь
             экран каждый раз. Тест уровня остаётся первым в списке: методичка
             и код всегда говорили начинать нового ученика с него. */}
      <button
        onClick={() => {
          const next = !more
          setMore(next)
          if (!next) setSection(null)
        }}
        aria-expanded={more}
        className="mt-1 flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-[var(--night-accent-text)]"
      >
        {more ? '▾' : '▸'} Ещё: тест уровня, диагностика, программа, слова
      </button>

      <Reveal open={more}>
        <div className="flex flex-col gap-2 pt-1">
          {SECTIONS.map((s) => (
            <div key={s.id}>
              <button
                onClick={() => setSection(section === s.id ? null : s.id)}
                aria-expanded={section === s.id}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-left text-sm"
              >
                <span>{s.title}</span>
                <span className="text-[var(--night-text-40)]">{section === s.id ? '▾' : '▸'}</span>
              </button>
              <Reveal open={section === s.id}>
                <div className="pt-2">
                  {s.id === 'placement' && (
                    <PlacementSection studentId={p.id} studentName={p.display_name ?? 'ученик'} />
                  )}
                  {s.id === 'diag' && (
                    <DiagnosticsSection
                      studentId={p.id}
                      studentName={p.display_name ?? 'Ученик'}
                      preloaded={diag}
                    />
                  )}
                  {s.id === 'plan' && <DailyPlanSection studentId={p.id} />}
                  {s.id === 'program' && <ProgramSection studentId={p.id} />}
                  {s.id === 'words' && (
                    <StudentWordsSection studentId={p.id} studentLevel={p.level ?? null} />
                  )}
                  {s.id === 'quests' && <QuestSection studentId={p.id} />}
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </Reveal>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        {seatsKnown && (
          <Button
            variant="ghost"
            className="min-h-[44px] px-3 py-2 text-sm"
            loading={seatBusy}
            onClick={async () => {
              setSeatBusy(true)
              setError(null)
              try {
                await setStudentSeat(p.id, !covered)
                onChanged()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Не удалось изменить место')
              } finally {
                setSeatBusy(false)
              }
            }}
          >
            {covered ? 'Освободить место тарифа' : 'Дать место тарифа'}
          </Button>
        )}
        <Button
          variant="ghost"
          className="min-h-[44px] px-3 py-2 text-sm text-rose-300"
          loading={unlinking}
          onClick={async () => {
            if (
              !window.confirm(
                `Отвязать ${p.display_name ?? 'ученика'}? Его аккаунт и прогресс останутся при нём, но ты перестанешь видеть его занятия и не сможешь назначать задания.`,
              )
            )
              return
            setUnlinking(true)
            setError(null)
            try {
              await unlinkStudent(p.id)
              onChanged()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Не удалось отвязать')
              setUnlinking(false)
            }
          }}
        >
          Отвязать
        </Button>
      </div>
    </Card>

    {composing && (
      <HomeworkComposer
        studentId={p.id}
        studentName={p.display_name ?? 'ученика'}
        // ⚠️ Язык берём из переключателя EN/ES в шапке, как весь остальной
        // раздел преподавателя (см. WordPicker). Сначала здесь стоял
        // profile.native_lang — а это РОДНОЙ язык ученика (русский), не
        // изучаемый: у преподавателя по испанскому домашка уходила бы с
        // lang='en', и пункт «слова» считал бы английскую колоду, то есть не
        // закрывался бы никогда.
        lang={appLang}
        // Уровень нужен подбору текста: читать выше своего уровня — это уже не
        // чтение. null (тест не проходили) подбор понимает и не завышает.
        level={p.level ?? null}
        onClose={() => setComposing(false)}
        onCreated={() => setHwVersion((v) => v + 1)}
      />
    )}
    </div>
  )
}

// Панель энергии студии (E3): общий дневной пул на всех учеников + месячные
// генерации материалов/программ. Показывается на вкладке «Ученики».
/**
 * Занятые места. Молчит, если миграция «САМОСТОЯТЕЛЬНАЯ РОЛЬ» ещё не залита
 * (seats тогда не приходит) или если аккаунт админский — у владельца лимитов нет.
 */
function Seats({ plan, used }: { plan: MyPlan | null; used: number }) {
  // seats нет в ответе — миграция не залита; 0 — не преподаватель; админ без лимитов
  if (!plan || plan.seats === undefined || plan.seats === 0 || plan.is_admin) return null
  const total = plan.seats // null = без ограничения

  if (total === null) {
    return (
      <div className="mt-3 border-t border-white/[0.06] pt-3">
        <p className="text-xs text-[var(--night-text-40)]">
          Учеников: <span className="text-[var(--night-text-70)]">{used}</span> · приглашать
          можно сколько нужно
        </p>
        <p className="mt-1.5 text-xs text-[var(--night-text-40)]">
          Сейчас у каждого ученика обычный бесплатный запас AI. Общий запас на всю студию и
          генерация материалов —{' '}
          <AppLink to="/pricing" className="text-[var(--night-accent)] underline underline-offset-2">
            на тарифе для преподавателей
          </AppLink>
          .
        </p>
      </div>
    )
  }

  const full = used >= total
  const onTrialSeats = typeof plan.free_seats === 'number' && total === plan.free_seats
  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <p className="text-xs text-[var(--night-text-40)]">
        Занято мест: <span className="text-[var(--night-text-70)]">{used} из {total}</span>
      </p>
      {full && (
        <p className="mt-1.5 text-xs text-[var(--night-text-70)]">
          {onTrialSeats
            ? `Пока идёт пробный период, учеников можно вести до ${total} — зато у каждого повышенный запас AI. Чтобы взять больше — `
            : 'Места тарифа заняты. Чтобы взять больше учеников — '}
          <AppLink to="/pricing" className="text-[var(--night-accent)] underline underline-offset-2">
            подключи тариф
          </AppLink>
          . Уже привязанные ученики останутся в любом случае.
        </p>
      )}
    </div>
  )
}

function StudioEnergy({ plan }: { plan: MyPlan }) {
  const max = plan.energy_max ?? 0
  const spent = plan.energy_spent ?? 0
  const left = Math.max(0, max - spent)
  const genLim = plan.gen_limit ?? 0
  const genUsed = plan.gen_used ?? 0
  const bar = (used: number, cap: number) => (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="h-full rounded-full bg-[var(--night-accent)] transition-[width] duration-500"
        style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }}
      />
    </div>
  )
  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <IconSparkle size={16} className="text-[var(--night-accent-text)]" /> Энергия студии
      </p>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--night-text-70)]">Разговоры с AI сегодня</span>
          <span className="font-medium">{left} из {max} осталось</span>
        </div>
        {bar(spent, max)}
        <p className="mt-1 text-xs text-[var(--night-text-40)]">
          Общий дневной запас на всех учеников. Пополняется утром.
        </p>
      </div>
      {genLim > 0 && (
        <div>
          <div className="flex items-center justify-between text-sm">
            {/* Раньше подпись называла только материалы и программы, а тот же
                счётчик тратят вопрос и график «Письма» — репетитор видел, как
                лимит тает от действий, которые материалами не считал. */}
            <span className="text-[var(--night-text-70)]">Генерации AI за месяц</span>
            <span className="font-medium">{genUsed} из {genLim}</span>
          </div>
          {bar(genUsed, genLim)}
          <p className="mt-1 text-xs text-[var(--night-text-40)]">
            Материалы, программы и задания «Письма». Материал стоит двух генераций
            (план и текст), каждая переделка — ещё одной.
          </p>
        </div>
      )}
    </Card>
  )
}
