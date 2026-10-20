// ============================================================================
// Вкладка «Ученики» студии (PLAN.md Ф2.5; макеты t6, d3): карточки учеников
// списком слева, выбранная — справа (на телефоне — отдельным экраном). У
// ученика в приложении под шапкой — его студия (домашка, плашки, «Ещё»), у
// карточки без приложения — «Пригласить в Recall».
//
// Строка ученика (Ф2.17-4б-1, макеты d3-1, d3-5, t6-1): вторая строка —
// ближайший урок, справа остаток, порядок — «Ближайший урок» или «Осталось
// уроков» с ↑↓, пробный «остаётся?» — сверху; ниже — «Группы». Сверх макета
// (журнал п.76 (5)) — бейдж домашки рядом с именем и сводка «Нужно внимание»
// над строками (lib/studentSignals). Держит ли ученик место тарифа — ответ
// базы (holds_seat), экран «первых N» сам не считает.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { dayBounds, loadLessonBalances, loadMySeries, loadSchedule, rosterWindow } from '../../domains/schedule'
import {
  ACTION_STATUS,
  setCardStatus,
  STATUS_LABEL,
  type CardAction,
  type CardStatus,
  type StudentCard,
} from '../../domains/students'
import { AttentionPanel } from '../schedule'
import { CardForm, StudentsList, useLeavingLessons } from '../students'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useNow } from '../../shared/lib/useNow'
import { useOnReturn } from '../../shared/lib/useOnReturn'
import { useUrlState } from '../../shared/lib/useUrlState'
import { ListDetail, useListDetailSplit } from '../../shared/ui/layouts'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { UndoToast } from '../../shared/ui/UndoToast'
import { needAttention, studentSignal, type StudentSignal } from '../../lib/studentSignals'
import type { StudentInfo } from '../../lib/teacher'
import { AttentionSummary, type StudentRow } from './StudentRowBits'
import type { Homework } from '../../lib/homework'
import type { MyPlan } from '../../lib/billing'
import { CardDetail } from './CardDetail'
import { rosterGroups, rosterRows, useRosterSort } from './roster'

/** Уроки две недели назад (пробные для вопроса «остаётся?») и вперёд (ближайшие). */
async function loadRosterLessons() {
  const w = rosterWindow(new Date())
  return loadSchedule(dayBounds(w.from).from, dayBounds(w.to).from)
}

export function StudentsTab({
  cards,
  students,
  homeworks,
  plan,
  loading,
  adding,
  onAddClose,
  generalInvite,
  notice,
  extras,
  onChanged,
}: {
  cards: StudentCard[]
  /** Ученики в приложении со сводкой занятий (по аккаунту). */
  students: StudentInfo[]
  homeworks: Map<string, Homework | null>
  plan: MyPlan | null
  loading: boolean
  /** «+ Ученик» в шапке экрана нажат — открыть шторку нового ученика. */
  adding: boolean
  onAddClose: () => void
  /** Общий код — второй экран шторки «+ Ученик». */
  generalInvite: ReactNode
  /** Сбой загрузки — над всем. */
  notice: ReactNode
  /** Энергия студии и общий код — под списком: в макетах t6 и d3 список идёт первым. */
  extras: ReactNode
  onChanged: () => void
}) {
  // список и карточка рядом (содержимое от 880, d0) — тот же ответ, что у ListDetail
  const desktop = useListDetailSplit()
  // Выбранная карточка — в адресе: свайп-назад в PWA возвращает к списку.
  // Старые ссылки вели по id аккаунта ученика — их тоже понимаем.
  const [openId, setOpenId] = useUrlState('student')
  const [form, setForm] = useState<StudentCard | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void } | null>(null)
  const leaving = useLeavingLessons()
  // остатки уроков (Ф2.8): число в строке, блок «Уроки», «Требуют внимания»
  const [balVersion, setBalVersion] = useState(0)
  const balanceRows = useAsyncData(loadLessonBalances, [balVersion], 'Не удалось загрузить остатки')
  const balances = new Map((balanceRows.data ?? []).map((b) => [b.cardId, b]))
  // из уведомления «остался 1 · Напомнить» — ?student=<карточка>&remind=1
  const [remind, setRemind] = useUrlState('remind')

  const seatsLimited = typeof plan?.seats === 'number' && !plan.is_admin
  const canWrite = plan?.can_write !== false

  // уроки и группы: вторая строка, порядок «Ближайший урок», «Группы», «Требуют внимания»
  const [lessonsVersion, setLessonsVersion] = useState(0)
  const reloadLessons = () => setLessonsVersion((v) => v + 1)
  const around = useAsyncData(loadRosterLessons, [lessonsVersion], 'Не удалось загрузить уроки')
  const series = useAsyncData(loadMySeries, [lessonsVersion], 'Не удалось загрузить группы')
  // учитель вернулся в приложение — уроки могли перенести (как список, Ф2.11б-2)
  useOnReturn(reloadLessons)
  const now = useNow()
  const sort = useRosterSort()

  const infoByUser = new Map(students.map((s) => [s.profile.id, s]))
  const rows: StudentRow[] = cards.map((card) => {
    const info = card.userId ? (infoByUser.get(card.userId) ?? null) : null
    return { card, info, signal: info ? studentSignal(info, homeworks.get(info.profile.id) ?? null) : null }
  })
  const roster = rosterRows({
    cards,
    signals: new Map(rows.map((r) => [r.card.id, r.signal])),
    balances,
    lessons: around.data,
    sort,
    seatsLimited,
    canWrite,
    now,
  })
  // «Нужно внимание» — по домашке и регулярности; на паузе и в архиве внимания не просят
  const watched = rows.filter((r) => r.signal && (r.card.status === 'active' || r.card.status === 'trial'))
  const attention = needAttention(watched.map((r) => r.signal as StudentSignal))

  const selected =
    rows.find((r) => r.card.id === openId) ?? rows.find((r) => openId && r.card.userId === openId) ?? null

  // пауза и архив убирают будущие уроки (журнал п.65, 1) — сперва сказать сколько
  const act = (card: StudentCard, action: CardAction) => {
    if (action === 'edit') return setForm(card)
    void leaving.check(card, ACTION_STATUS[action], () => void apply(card, ACTION_STATUS[action]))
  }
  const apply = async (card: StudentCard, next: CardStatus) => {
    const prev = card.status
    setBusy(true)
    setActionError(null)
    try {
      await setCardStatus(card.id, next)
      onChanged()
      // пауза и архив убирают будущие уроки — вторая строка и «Группы» тоже
      reloadLessons()
      if (next === 'archived') {
        setToast({
          id: Date.now(),
          text: `${card.name} — в архиве`,
          undo: () => void setCardStatus(card.id, prev).then(onChanged, (e) => setActionError(String(e?.message ?? e))),
        })
      } else {
        setToast({ id: Date.now(), text: `${card.name}: ${STATUS_LABEL[next].toLowerCase()}` })
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось поменять статус')
    } finally {
      setBusy(false)
    }
  }

  const list = loading ? (
    <RowsSkeleton count={3} />
  ) : (
    <StudentsList
      rows={roster}
      groups={rosterGroups(series.data, around.data, now)}
      sort={sort}
      attention={
        <>
          {/* уроки не пришли — во второй строке пусто, а не «уроков нет» (Ф1.13) */}
          {around.error && <LoadError message={around.error} onRetry={reloadLessons} />}
          <AttentionSummary watched={watched} count={attention} />
        </>
      }
      footer={extras}
      seats={plan}
      selectedId={selected?.card.id ?? null}
      canWrite={canWrite}
      wide={desktop}
      onOpen={(id) => setOpenId(id)}
    />
  )

  const detail = selected ? (
    <CardDetail
      key={selected.card.id}
      card={selected.card}
      info={selected.info}
      plan={plan}
      balance={balances.get(selected.card.id) ?? null}
      canWrite={canWrite}
      busy={busy}
      actionError={actionError}
      autoRemind={remind === '1'}
      onRemindShown={() => setRemind(null)}
      onBack={desktop ? undefined : () => setOpenId(null)}
      onAction={(a) => void act(selected.card, a)}
      onChanged={onChanged}
      onBalances={() => setBalVersion((v) => v + 1)}
    />
  ) : desktop && !loading ? (
    // никто не выбран — кого стоит не забыть (макет d3-3)
    <AttentionPanel
      cards={cards}
      lessons={around.data}
      balances={balances}
      canWrite={canWrite}
      onOpen={(id) => setOpenId(id)}
    />
  ) : null

  return (
    <>
      {notice}
      <ListDetail fill list={list} detail={detail} empty="Выбери ученика слева — карточка откроется здесь." />
      {(form || adding) && (
        <CardForm
          card={form}
          generalInvite={generalInvite}
          onClose={() => {
            setForm(null)
            onAddClose()
          }}
          onSaved={(id) => {
            setForm(null)
            onAddClose()
            setOpenId(id)
            onChanged()
          }}
        />
      )}
      {toast && <UndoToast key={toast.id} text={toast.text} onAction={toast.undo} onClose={() => setToast(null)} />}
      {leaving.sheet}
    </>
  )
}
