// ============================================================================
// Просьба включить уведомления на Главной ученика (PLAN.md Ф2.9; макеты u3-3,
// u3-4; журнал п.38, 42, 68). Когда спросить — domains/notifications/ask.ts:
// только если есть уроки; iPhone во вкладке — инструкция «На экран Домой»;
// «Не сейчас» — один раз через 14 дней, дальше только из Настроек.
// Окно разрешения браузера — только по нажатию «Включить»: iPhone без жеста
// его не покажет, а запрет, данный машинально, вернуть можно лишь в настройках.
// ============================================================================
import { useEffect, useState } from 'react'
import { askMemory, devicePush, enablePush, pushAsk, rememberPostponed, type PushAsk } from '../../domains/notifications'
import { Button } from '../../shared/ui/Button'
import { IconBell, IconInfo } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'
import { IosInstallCard } from './IosInstallCard'

type Outcome = 'idle' | 'busy' | 'denied' | 'failed'

const OUTCOME_TEXT: Record<'denied' | 'failed', string> = {
  denied: 'Уведомления запрещены в настройках браузера. Разрешить их можно там — в настройках сайта Recall.',
  failed: 'Не получилось включить уведомления на этом устройстве. Попробуй ещё раз позже — или в Настройках.',
}

export function LessonPushAsk({ hasLessons }: { hasLessons: boolean }) {
  const [ask, setAsk] = useState<PushAsk>(null)
  const [done, setDone] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>('idle')

  // что предложить — один раз, когда стало известно, что умеет устройство
  useEffect(() => {
    if (!hasLessons) return
    let alive = true
    void devicePush().then((d) => {
      // service worker не готов — «Включить» не сработает; iPhone во вкладке — инструкция всё равно
      const support = d.ready || d.support === 'install' ? d.support : 'unsupported'
      if (alive) setAsk(pushAsk({ support, subscribed: d.subscribed, hasLessons, asked: askMemory(), now: Date.now() }))
    })
    return () => {
      alive = false
    }
  }, [hasLessons])

  if (!ask || done) return null
  const later = () => {
    rememberPostponed()
    setDone(true)
  }

  if (ask === 'install') return <IosInstallCard onHide={later} />
  if (ask !== 'prompt') return null

  const enable = async () => {
    setOutcome('busy')
    const r = await enablePush().catch(() => 'unsupported' as const)
    if (r === 'on') setDone(true)
    else setOutcome(r === 'denied' ? 'denied' : 'failed')
  }

  return (
    <Sheet onClose={outcome === 'idle' ? later : () => setDone(true)} labelledBy="push-ask-title">
      <div data-push-ask className="flex flex-col items-center gap-3 px-5 pb-5 pt-2 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
          <IconBell size={26} />
        </span>
        <h2 id="push-ask-title" className="text-xl font-semibold tracking-tight text-fg">
          Включить уведомления?
        </h2>
        {outcome === 'denied' || outcome === 'failed' ? (
          <>
            <p className="max-w-sm text-sm text-fg-secondary">{OUTCOME_TEXT[outcome]}</p>
            <Button className="mt-2 w-full" onClick={() => setDone(true)}>
              Понятно
            </Button>
          </>
        ) : (
          <>
            <p className="max-w-sm text-sm text-fg-secondary">
              Напомним за час до урока и скажем, если урок перенесут или отменят. Больше ничего присылать не будем.
            </p>
            <Button className="mt-2 w-full" loading={outcome === 'busy'} onClick={() => void enable()}>
              Включить
            </Button>
            <Button variant="ghost" className="w-full" disabled={outcome === 'busy'} onClick={later}>
              Не сейчас
            </Button>
            <p className="flex items-start gap-1.5 text-left text-note text-fg-muted">
              <IconInfo size={14} aria-hidden className="mt-0.5 flex-none" />
              Напоминание об уроке можно выключить в настройках.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
