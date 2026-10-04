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
import { Card } from '../../shared/ui/Card'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { UndoToast } from '../../shared/ui/UndoToast'
import { byAttention, needAttention, studentSignal, type StudentSignal } from '../../lib/studentSignals'
import type { StudentInfo } from '../../lib/teacher'
import type { Homework } from '../../lib/homework'
import type { MyPlan } from '../../lib/billing'
import { CardDetail } from './CardDetail'

interface Row {
  card: StudentCard
  info: StudentInfo | null
  signal: StudentSignal | null
}

/** Человеческий срок последнего занятия. */
function lastSeen(s: StudentInfo): string {
  const d = s.daysSinceActive
  if (d === null) return 'ещё не начинал'
  if (d === 0) return 'занимался сегодня'
  if (d === 1) return 'был вчера'
  return `не заходил ${d} ${d < 5 ? 'дня' : 'дней'}`
}

export function StudentsTab({
  cards,
  students,
  homeworks,
  plan,
  loading,
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
  const [form, setForm] = useState<'new' | StudentCard | null>(null)
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
  const rows: Row[] = cards.map((card) => {
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

  const detailOf = (card: StudentCard): ReactNode => {
    const r = rowById.get(card.id)
    if (r?.info && r.signal) {
      const s = r.signal
      return (
        <>
          {/* Домашка — первое, что нужно перед уроком: «3 из 5 · до вторника». */}
          <span className={`block truncate text-sm ${s.overdue ? 'text-warning-soft-fg' : 'text-fg-secondary'}`}>
            {s.homeworkText ? `${s.homeworkText} · ${s.dueText}` : 'Домашка не выдана'}
          </span>
          {/* ⚠️ Регулярность, а не объём: «занимался 5 дней из 7» — привычка. */}
          <span className="block truncate text-sm text-fg-muted">
            занимался {s.regularity} ·{' '}
            <span className={s.lost ? 'text-warning-soft-fg' : ''}>{lastSeen(r.info)}</span>
          </span>
        </>
      )
    }
    return <span className="block truncate text-sm text-fg-muted">{card.contact || 'без приложения'}</span>
  }

  const attentionCard =
    attention > 0 ? (
      <Card tone="warning">
        <p className="text-sm font-semibold text-warning-soft-fg">Нужно внимание: {attention}</p>
        <p className="mt-1 text-sm text-fg-secondary">
          {byAttention(watched, (r) => r.signal as StudentSignal)
            .filter((r) => r.signal?.attention === 'overdue' || r.signal?.attention === 'lost')
            .map((r) => `${r.card.name} — ${r.signal?.overdue ? 'домашка просрочена' : lastSeen(r.info as StudentInfo)}`)
            .join(' · ')}
        </p>
        <p className="mt-2 text-xs text-fg-muted">
          {watched.some((r) => r.signal?.lost)
            ? 'Неделя без занятий — обычно момент, когда стоит написать самому.'
            : 'Срок домашки прошёл, а сделано не всё.'}
        </p>
      </Card>
    ) : null

  const list = loading ? (
    <RowsSkeleton count={3} />
  ) : (
    <div className="flex flex-col gap-4">
      <StudentsList
        cards={ordered.map((r) => r.card)}
        detailOf={detailOf}
        outsideOf={(c) => outsideSeats(c, seatsLimited)}
        trailingOf={(c) => (balanceShort(balances.get(c.id)) ? <BalanceCount balance={balances.get(c.id)} /> : null)}
        attention={attentionCard}
        seats={plan}
        selectedId={selected?.card.id ?? null}
        canWrite={canWrite}
        onOpen={(id) => setOpenId(id)}
        onAdd={() => setForm('new')}
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
      <ListDetail list={list} detail={detail} empty="Выбери ученика слева — карточка откроется здесь." />
      {form && (
        <CardForm
          card={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setForm(null)
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
