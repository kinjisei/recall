// ============================================================================
// Вкладка «Ученики» студии (PLAN.md Ф2.5; макеты t6, d3): карточки учеников
// списком слева, выбранная — справа (на телефоне — отдельным экраном). У
// ученика в приложении под шапкой — его студия (домашка, плашки, «Ещё»), у
// карточки без приложения — «Пригласить в Recall».
//
// Строка ученика в приложении по-прежнему отвечает «кем заняться»: домашка,
// регулярность, последнее занятие (lib/studentSignals); сортировка — сперва
// те, кому нужно внимание. Держит ли ученик место тарифа — ответ базы
// (holds_seat), экран «первых N» сам не считает.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { balanceShort, loadLessonBalances } from '../../domains/schedule'
import {
  ACTION_STATUS,
  outsideSeats,
  setCardStatus,
  STATUS_LABEL,
  type CardAction,
  type CardStatus,
  type StudentCard,
} from '../../domains/students'
import { AttentionPanel, BalanceCount } from '../schedule'
import { CardForm, StudentsList, useLeavingLessons } from '../students'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useUrlState } from '../../shared/lib/useUrlState'
import { useIsDesktop } from '../../shared/lib/useMediaQuery'
import { ListDetail } from '../../shared/ui/layouts'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { UndoToast } from '../../shared/ui/UndoToast'
import { byAttention, needAttention, studentSignal, type StudentSignal } from '../../lib/studentSignals'
import type { StudentInfo } from '../../lib/teacher'
import { AttentionSummary, RowDetail, type StudentRow } from './StudentRowBits'
import type { Homework } from '../../lib/homework'
import type { MyPlan } from '../../lib/billing'
import { CardDetail } from './CardDetail'

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
  const desktop = useIsDesktop()
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

  const infoByUser = new Map(students.map((s) => [s.profile.id, s]))
  const rows: StudentRow[] = cards.map((card) => {
    const info = card.userId ? (infoByUser.get(card.userId) ?? null) : null
    return { card, info, signal: info ? studentSignal(info, homeworks.get(info.profile.id) ?? null) : null }
  })
  // В приложении — по дате привязки (byAttention держит её внутри группы, чтобы
  // список не перескакивал), сперва те, кому нужно внимание; без приложения — по имени.
  const inApp = rows
    .filter((r) => r.signal)
    .sort((a, b) => (a.card.linkedAt ?? '').localeCompare(b.card.linkedAt ?? ''))
  const noApp = rows.filter((r) => !r.signal).sort((a, b) => a.card.name.localeCompare(b.card.name, 'ru'))
  const ordered = [...byAttention(inApp, (r) => r.signal as StudentSignal), ...noApp]
  const rowById = new Map(rows.map((r) => [r.card.id, r]))
  // На паузе и в архиве не занимаются по договорённости — внимания не просят
  const watched = inApp.filter((r) => r.card.status === 'active' || r.card.status === 'trial')
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
    <div className="flex flex-col gap-4">
      <StudentsList
        cards={ordered.map((r) => r.card)}
        detailOf={(c) => <RowDetail row={rowById.get(c.id)} card={c} />}
        outsideOf={(c) => outsideSeats(c, seatsLimited)}
        trailingOf={(c) => (balanceShort(balances.get(c.id)) ? <BalanceCount balance={balances.get(c.id)} /> : null)}
        attention={<AttentionSummary watched={watched} count={attention} />}
        seats={plan}
        selectedId={selected?.card.id ?? null}
        canWrite={canWrite}
        onOpen={(id) => setOpenId(id)}
      />
      {extras}
    </div>
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
      balances={balances}
      canWrite={canWrite}
      empty="Выбери ученика слева — карточка откроется здесь."
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
