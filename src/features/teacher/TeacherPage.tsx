import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconGraduation, IconFlame, IconBadgeCheck } from '../../components/icons'
import { BackHeader } from '../../components/BackButton'
import { GOAL_LABELS } from '../../types'
import { useUrlState } from '../../lib/useUrlState'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getProfile } from '../../lib/profile'
import { useAuth } from '../../context/AuthContext'
import {
  getOrCreateInviteCode,
  regenerateInviteCode,
  becomeTeacher,
  stopTeaching,
  setStudentSeat,
  unlinkStudent,
  getMyStudents,
  getMyDecks,
  assignDeck,
  unassignDeck,
  type StudentInfo,
} from '../../lib/teacher'
import { MaterialsSection } from './MaterialsSection'
import { WritingSection } from './WritingSection'
import { StudentWordsSection } from './StudentWordsSection'
import { QuestSection } from './QuestSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { DeckWordsPicker } from './DeckWordsPicker'
import { GuideSection } from './GuideSection'
import { DailyPlanSection } from './DailyPlanSection'
import { countSubmittedWorks } from '../../lib/materials'
import { countSubmittedWriting } from '../../lib/writing'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { IconSparkle } from '../../components/icons'
import type { Deck, Profile } from '../../types'

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

  if (loading) return <p className="text-[var(--night-text-40)]">Загрузка…</p>

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
  const tab = (rawTab as TeacherTab | null) ?? 'students'
  const setTab = (t: TeacherTab) => setRawTab(t === 'students' ? null : t)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
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
      const [c, s, d, pending, pendingW] = await Promise.all([
        getOrCreateInviteCode(),
        getMyStudents(),
        getMyDecks(),
        countSubmittedWorks().catch(() => 0), // был отдельным шагом ПОСЛЕ Promise.all
        countSubmittedWriting().catch(() => 0),
      ])
      setCode(c)
      setStudents(s)
      setDecks(d)
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
                {copied ? 'Скопирован ✓' : 'Скопировать'}
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
            <p className="text-[var(--night-text-40)]">Загрузка…</p>
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
            students.map((s, i) => (
              <StudentCard
                key={s.profile.id}
                student={s}
                decks={decks}
                onChanged={load}
                // то же правило, что в БД: пока мест никто не выбирал, их держат
                // первые N по дате привязки; как только выбор сделан — решает он
                covered={
                  typeof myPlan?.seats !== 'number'
                    ? true
                    : students.some((x) => x.seat)
                      ? s.seat
                      : i < myPlan.seats
                }
                seatsKnown={typeof myPlan?.seats === 'number'}
              />
            ))
          )}
        </>
      )}
    </div>
  )
}

function StudentCard({
  student,
  decks,
  onChanged,
  covered = true,
  seatsKnown = false,
}: {
  student: StudentInfo
  decks: Deck[]
  onChanged: () => void
  /** Покрыт ли ученик тарифом: сверх мест AI-возможности у него обычные, бесплатные. */
  covered?: boolean
  /** Есть ли вообще ограничение мест (на тарифе без лимита переключать нечего). */
  seatsKnown?: boolean
}) {
  const [seatBusy, setSeatBusy] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [showDecks, setShowDecks] = useState(false)
  const [showWords, setShowWords] = useState(false)
  const [showQuests, setShowQuests] = useState(false)
  const [showDiag, setShowDiag] = useState(false)
  const [showProgram, setShowProgram] = useState(false)
  const [showPlanDay, setShowPlanDay] = useState(false)
  /** id набора, чьи слова сейчас раскрыты (просмотр + выборочное назначение). */
  const [openDeck, setOpenDeck] = useState<string | null>(null)
  const [busyDeck, setBusyDeck] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const p = student.profile

  const toggleDeck = async (deck: Deck) => {
    setBusyDeck(deck.id)
    setError(null)
    try {
      if (student.assignedDeckIds.includes(deck.id)) {
        await unassignDeck(deck.id, p.id)
      } else {
        await assignDeck(deck.id, p.id)
      }
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить назначение')
    } finally {
      setBusyDeck(null)
    }
  }

  return (
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

      <button
        onClick={() => setShowDecks((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showDecks ? '▾ Скрыть наборы слов' : `▸ Наборы слов (назначено: ${student.assignedDeckIds.length})`}
      </button>

      {showDecks && (
        <div className="flex flex-col gap-2">
          {decks.map((d) => {
            const assigned = student.assignedDeckIds.includes(d.id)
            const opened = openDeck === d.id
            return (
              <div
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.08] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* тап по названию раскрывает слова — назначение больше не вслепую */}
                  <button
                    onClick={() => setOpenDeck(opened ? null : d.id)}
                    className="min-h-[44px] min-w-0 flex-1 text-left text-sm font-medium"
                    aria-expanded={opened}
                  >
                    <span className="truncate">{d.title}</span>{' '}
                    <span className="text-xs text-[var(--night-text-40)]">
                      ({d.lang ?? 'en'}) {opened ? '▾' : '▸ слова'}
                    </span>
                  </button>
                  <Button
                    variant={assigned ? 'ghost' : 'secondary'}
                    className="shrink-0 px-3 py-1.5 text-sm"
                    disabled={busyDeck !== null}
                    onClick={() => toggleDeck(d)}
                  >
                    {busyDeck === d.id ? '…' : assigned ? 'Убрать ✓' : 'Назначить'}
                  </Button>
                </div>
                {opened && (
                  <DeckWordsPicker
                    deck={d}
                    studentId={p.id}
                    studentName={p.display_name ?? 'ученика'}
                    onAssigned={onChanged}
                  />
                )}
              </div>
            )
          })}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      {/* Тест уровня — ПЕРВЫМ. Комментарий в коде и методичка всегда говорили,
          что с нового ученика надо начинать именно с него, но на экране он
          стоял третьим — после колод и диагностики (находка ревью 1В). */}
      <PlacementSection studentId={p.id} studentName={p.display_name ?? 'ученик'} />

      <button
        onClick={() => setShowDiag((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showDiag ? '▾ Скрыть диагностику' : '▸ Диагностическая карта'}
      </button>
      {showDiag && (
        <DiagnosticsSection studentId={p.id} studentName={p.display_name ?? 'Ученик'} />
      )}

      <button
        onClick={() => setShowPlanDay((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showPlanDay ? '▾ Скрыть план дня' : '▸ План дня'}
      </button>
      {showPlanDay && <DailyPlanSection studentId={p.id} />}

      <button
        onClick={() => setShowProgram((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showProgram ? '▾ Скрыть программу' : '▸ Программа обучения'}
      </button>
      {showProgram && <ProgramSection studentId={p.id} />}

      <button
        onClick={() => setShowWords((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showWords ? '▾ Скрыть слова' : '▸ Слова и перепроверка'}
      </button>
      {showWords && <StudentWordsSection studentId={p.id} />}

      <button
        onClick={() => setShowQuests((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline"
      >
        {showQuests ? '▾ Скрыть AI-квесты' : '▸ AI-квесты по грамматике'}
      </button>
      {showQuests && <QuestSection studentId={p.id} />}

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
          <Link to="/pricing" className="text-[var(--night-accent)] underline underline-offset-2">
            на тарифе для преподавателей
          </Link>
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
          <Link to="/pricing" className="text-[var(--night-accent)] underline underline-offset-2">
            подключи тариф
          </Link>
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
