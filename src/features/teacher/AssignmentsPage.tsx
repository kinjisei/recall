// ============================================================================
// Экран «Домашка» у ученика (роут /assignments).
//
// Сверху — домашка на неделю одним списком: срок, счёт, пункты с прогрессом
// внутри. Ниже — задания-материалы от преподавателя. Раннер задания (текст →
// упражнения → сдача, `assignment/AssignmentRunner`) — под ?a=<id>.
//
// ⚠️ ПОЧЕМУ ДОМАШКА ЖИВЁТ ЗДЕСЬ, А НЕ ОТДЕЛЬНЫМ РОУТОМ. У одной работы должен
// остаться ОДИН способ её сделать. Домашка — указатель: её пункты открывают те
// же экраны (/quests, /writing, /practice, /pronunciation) и тот же раннер
// задания. Заведи домашка свои кнопки «сдать» — и получилось бы два пути
// закрыть одно и то же, а на «своём» экране работа осталась бы новой.
// ============================================================================
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { LoadError } from '../../shared/ui/LoadError'
import { IconTray } from '../../shared/ui/icons'
import { getMyAssignments } from '../../lib/materialAssignments'
import { workScore } from '../../lib/assignmentScore'
import { getHomework, type Homework } from '../../lib/homework'
import { StudentHomework } from '../homework/StudentHomework'
import { useScrollTop } from '../../lib/useScrollTop'
import { useUrlStates } from '../../shared/lib/useUrlState'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { AssignmentRunner, STAGES, type Stage } from './assignment/AssignmentRunner'
import { ReviewedView } from './assignment/ReviewedView'
import type { Row } from './assignment/TappableBody'

/** Константа, а не литерал на каждый рендер: иначе set из хука пересоздаётся зря. */
const URL_KEYS = ['a', 'stage']

/** Черновик прохождения: что уже отвечено и на каком упражнении человек стоит. */
export function AssignmentsPage() {
  const navigate = useNavigate()
  // Открытое задание и стадия — в адресе (?a=<id>&stage=read), а не в useState.
  // Раньше «назад» из упражнений выбрасывал на Главную мимо списка заданий,
  // F5 терял место, а по адресу нельзя было понять, что вообще открыто.
  // Именно useUrlStates: id и стадия меняются ОДНИМ движением, два отдельных
  // useUrlState затёрли бы друг друга (каждый читает свой снимок params).
  const [url, setUrl] = useUrlStates(URL_KEYS)
  // ?? null — из-за noUncheckedIndexedAccess чтение по ключу даёт ещё и undefined
  const activeId = url.a ?? null

  // при сбое показываем ошибку, а не «Заданий пока нет»: раньше ученик
  // думал, что работы нет, и не повторял попытку
  const {
    data: rows,
    error,
    loading,
    reload,
  } = useAsyncData<Row[]>(() => getMyAssignments(), [], 'Не удалось загрузить задания')

  // Домашку тянем отдельно и молча: если её нет или запрос упал, экран обязан
  // остаться рабочим списком заданий — как был до этого захода.
  const { data: hw, reload: reloadHw } = useAsyncData<Homework | null>(
    () => getHomework().catch(() => null),
    [],
    '',
  )

  const active = activeId ? ((rows ?? []).find((r) => r.id === activeId) ?? null) : null
  // стадия по умолчанию зависит от работы: проверенную открываем с разбора
  // преподавателя, остальные — с текста. Мусор в адресе трактуется как «нет».
  const stage: Stage = STAGES.includes(url.stage ?? '')
    ? (url.stage as Stage)
    : active?.status === 'reviewed'
      ? 'review'
      : 'read'

  useScrollTop(activeId)

  const open = (row: Row) =>
    setUrl({ a: row.id, stage: row.status === 'reviewed' ? 'review' : 'read' })
  const close = () => setUrl({ a: null, stage: null })
  const setStage = (s: Stage) => setUrl({ a: activeId, stage: s })

  // Чужая или устаревшая ссылка (задание сняли, id из чужой переписки): такого
  // задания у ученика нет — возвращаем в список, а не показываем пустоту.
  // Ждём именно загрузки rows, иначе F5 внутри задания вышибал бы наружу.
  useEffect(() => {
    if (activeId && rows && !rows.some((r) => r.id === activeId)) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, rows])

  if (active) {
    // проверенная работа — сначала разбор от преподавателя;
    // «Пройти заново» переключает на упражнения (без пересдачи)
    if (stage === 'review') {
      return <ReviewedView row={active} onBack={close} onRetry={() => setStage('read')} />
    }
    return (
      <AssignmentRunner
        // смена задания через адрес (?a=другое) обязана начинать раннер заново
        key={active.id}
        row={active}
        stage={stage}
        onStage={setStage}
        onDone={() => {
          close()
          reload()
        }}
        onBack={close}
      />
    )
  }

  const pending = (rows ?? []).filter((r) => r.status === 'assigned')
  const done = (rows ?? []).filter((r) => r.status !== 'assigned')

  const nothingAtAll = !hw && (rows ?? []).length === 0

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={() => navigate('/study')} title="Домашка" label="К учёбе" />

      {hw && <StudentHomework hw={hw} onChanged={reloadHw} />}

      {loading ? (
        <RowsSkeleton count={3} />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : nothingAtAll ? (
        <Card className="text-center">
          <IconTray size={38} className="mx-auto block text-fg-muted" />
          <p className="mt-2 font-semibold">Пока ничего не задано</p>
          <p className="mt-1 text-sm text-fg-muted">
            Когда преподаватель выдаст домашку или задание, они появятся здесь.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-fg-muted">
                {hw ? 'Задания от преподавателя' : 'Новые'}
              </h2>
              {pending.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => open(r)} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-fg-muted">Выполненные</h2>
              {done.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => open(r)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function AssignmentCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const m = row.material
  // в баллах (у пар — по паре), как у проверки учителя
  const score = workScore(m.exercises, row.answers, row.teacher_review)
  return (
    <button onClick={onOpen} className="text-left">
      <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
        <div className="min-w-0">
          <p className="truncate font-medium">{m.title ?? m.topic}</p>
          <p className="text-xs text-fg-muted">
            {m.lang.toUpperCase()} · {m.level} · {m.format} · {m.exercises.length} упр.
            {(row.attempts?.length ?? 0) > 0 && row.status === 'assigned' && (
              <span className="ml-1 font-semibold text-warning">
                · повторно
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 text-right text-sm">
          {row.status === 'assigned' ? (
            <span className="rounded-full bg-warning-soft/50 px-2 py-0.5 text-xs font-semibold text-warning-strong">
              новое
            </span>
          ) : row.status === 'submitted' ? (
            <>
              <span className="block text-fg-muted">на проверке</span>
              <span className="block text-xs text-accent-strong">тренироваться →</span>
            </>
          ) : (
            <>
              <span className="block font-semibold text-success-strong">
                ✓ {score.got}/{score.of}
              </span>
              <span className="block text-xs text-accent-strong">тренироваться →</span>
            </>
          )}
        </span>
      </Card>
    </button>
  )
}
