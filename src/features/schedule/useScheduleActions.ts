// ============================================================================
// Действия расписания и их последствия: тост «… · Вернуть», «Сообщи
// ученику» (кому — whoToTell: до Ф2.9 всем, потом — только без приложения),
// переход к дню урока, перечитать после записи. Шторки только сообщают, что
// сделали (Done), — что показать дальше, решает здесь одно место.
// ============================================================================
import { useState } from 'react'
import {
  markParticipant,
  reminderMessage,
  restoreLesson,
  whoToTell,
  type Lesson,
  type Outcome,
} from '../../domains/schedule'
import { firstName, setCardStatus, type StudentCard } from '../../domains/students'
import { useLeavingLessons } from '../students'
import type { FormMode } from './LessonForm'
import type { Tell } from './TellSheet'
import type { Done } from './types'

export type Panel =
  | { kind: 'form'; mode: FormMode }
  | { kind: 'move'; lesson: Lesson }
  | { kind: 'cancel'; lesson: Lesson }
  | { kind: 'paid'; cardId: string; name: string }
  | { kind: 'card' }
  | { kind: 'tell'; tell: Tell }

export interface Toast {
  id: number
  text: string
  actionLabel?: string
  action?: () => void
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

export function useScheduleActions({
  cards,
  refresh,
  goToDay,
  closeLesson,
}: {
  cards: Map<string, StudentCard>
  refresh: () => void
  goToDay: (day: string) => void
  closeLesson: () => void
}) {
  const [panel, setPanel] = useState<Panel | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // «Нет» после пробного — архив: назначенные уроки уйдут, сказать заранее (п.65, 1)
  const leaving = useLeavingLessons()

  const say = (text: string, actionLabel?: string, action?: () => void) => setToast({ id: Date.now(), text, actionLabel, action })

  /** Кому и что написать — по карточкам урока. */
  const tellOf = (t: NonNullable<Done['tell']>): Tell | null => {
    const people = whoToTell(
      t.cardIds.map((cardId) => ({ cardId, card: cards.get(cardId) })),
      (id) => cards.get(id)?.inApp === true,
    ).filter((x): x is { cardId: string; card: StudentCard } => !!x.card)
    if (!people.length) return null
    return {
      title: t.title,
      url: t.url ?? window.location.origin,
      items: people.map(({ cardId, card }) => ({
        cardId,
        name: card.name,
        contact: card.contact,
        inApp: card.inApp,
        text: t.text(firstName(card.name)),
      })),
    }
  }

  /** Шторка сделала своё: перечитать, показать день, тост, «Сообщи ученику». */
  const done = (d: Done) => {
    refresh()
    closeLesson()
    if (d.day) goToDay(d.day)
    const tell = d.tell ? tellOf(d.tell) : null
    setPanel(tell ? { kind: 'tell', tell } : null)
    const undo = d.undo
    say(
      d.toast,
      undo ? 'Вернуть' : undefined,
      undo ? () => void undo().then(refresh, (e) => say(message(e, 'Не удалось вернуть'))) : undefined,
    )
  }

  const run = async (work: () => Promise<unknown>, fallback: string) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      refresh()
    } catch (e) {
      setError(message(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  return {
    panel,
    setPanel,
    toast,
    closeToast: () => setToast(null),
    say,
    busy,
    error,
    done,
    mark: (l: Lesson, cardId: string, outcome: Outcome) => run(() => markParticipant(l.id, cardId, outcome), 'Не удалось отметить урок'),
    allPresent: (l: Lesson) =>
      run(async () => {
        for (const p of l.participants.filter((x) => x.charge === null)) await markParticipant(l.id, p.cardId, 'present')
      }, 'Не удалось отметить урок'),
    restore: (l: Lesson) =>
      run(async () => {
        await restoreLesson(l.id)
        say('Урок возвращён')
      }, 'Не удалось вернуть урок'),
    remind: (l: Lesson) => {
      const tell = tellOf({ title: 'Напомнить об уроке', cardIds: l.participants.map((p) => p.cardId), text: (who) => reminderMessage(who, l), url: l.link })
      if (tell) setPanel({ kind: 'tell', tell })
    },
    leavingSheet: leaving.sheet,
    /** «Остаётся заниматься?» (журнал п.30): да — «занимается» и оплата, нет — архив с «Вернуть». */
    answerTrial: async (cardId: string, name: string, stays: boolean) => {
      const card = cards.get(cardId)
      if (!stays && card) return leaving.check(card, 'archived', () => void answer(cardId, name, false))
      return answer(cardId, name, stays)
    },
  }

  function answer(cardId: string, name: string, stays: boolean) {
    return run(async () => {
      await setCardStatus(cardId, stays ? 'active' : 'archived')
      closeLesson()
      if (stays) setPanel({ kind: 'paid', cardId, name: firstName(name) })
      else
        say(`${firstName(name)} в архиве`, 'Вернуть', () =>
          void setCardStatus(cardId, 'trial').then(refresh, (e) => say(message(e, 'Не удалось вернуть'))),
        )
    }, 'Не удалось сохранить ответ')
  }
}
