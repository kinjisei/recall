// ============================================================================
// «Уведомления» в Настройках ученика (PLAN.md Ф2.9; макет u4-1; журнал п.38,
// 42): «Напоминать о скором уроке — за час до начала» (выключается) и «О
// переносе и отмене урока сообщим всегда» (не выключается). Плюс это
// устройство: включить, выключить или почему нельзя — просьба на Главной
// после «Не сейчас» больше не всплывает, и включить можно только здесь.
// Раздел — только ученику, у которого есть преподаватель: у самоучки уроков
// нет, у репетитора напоминаний о скором уроке нет (макет u4-2).
// ============================================================================
import { useState } from 'react'
import {
  devicePush,
  disablePush,
  enablePush,
  loadLessonReminders,
  setLessonReminders,
  type DevicePush,
} from '../../domains/notifications'
import { loadMyLessonBalances } from '../../domains/schedule'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { IconInfo } from '../../shared/ui/icons'
import { Switch } from '../../shared/ui/Switch'

async function loadSection() {
  const teachers = await loadMyLessonBalances()
  if (!teachers.length) return null
  const [reminders, device] = await Promise.all([loadLessonReminders(), devicePush()])
  return { reminders, device }
}

/** Что сказать про это устройство и какую кнопку дать. */
function deviceLine(d: DevicePush): { text: string; action?: 'on' | 'off' } {
  if ((d.support === 'default' || d.support === 'granted') && !d.ready) {
    return { text: 'Приложение ещё загружается — включить уведомления можно будет через минуту, загляни сюда ещё раз' }
  }
  switch (d.support) {
    case 'granted':
      return d.subscribed ? { text: 'На этом устройстве уведомления включены', action: 'off' } : { text: 'На этом устройстве уведомления выключены', action: 'on' }
    case 'default':
      return { text: 'На этом устройстве уведомления выключены', action: 'on' }
    case 'denied':
      return { text: 'Уведомления запрещены в настройках браузера — разреши их там для сайта Recall' }
    case 'install':
      return { text: 'На iPhone уведомления приходят только от приложения с экрана «Домой»: Safari → «Поделиться» → «На экран «Домой»»' }
    default:
      return { text: 'Этот браузер не умеет уведомления — открой Recall в Chrome или Safari' }
  }
}

export function LessonReminders() {
  const { data, error } = useAsyncData(loadSection, [], 'Не удалось загрузить настройки уведомлений')
  const [reminders, setReminders] = useState<boolean | null>(null)
  const [device, setDevice] = useState<DevicePush | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (error) return null // раздел необязательный: без связи Настройки работают без него
  if (!data) return null
  const on = reminders ?? data.reminders
  const dev = device ?? data.device
  const line = deviceLine(dev)

  const toggle = async (next: boolean) => {
    setReminders(next)
    setProblem(null)
    try {
      await setLessonReminders(next)
    } catch (e) {
      setReminders(!next)
      setProblem(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }
  const switchDevice = async () => {
    setBusy(true)
    setProblem(null)
    try {
      if (line.action === 'off') await disablePush()
      else {
        const r = await enablePush()
        if (r === 'denied') setProblem('Уведомления запрещены в настройках браузера — разреши их там для сайта Recall.')
        if (r === 'unsupported') setProblem('Не получилось включить уведомления на этом устройстве.')
      }
      setDevice(await devicePush())
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Не получилось')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-lesson-reminders aria-labelledby="reminders-title" className="flex flex-col gap-2">
      <h2 id="reminders-title" className="px-1 text-caption font-semibold uppercase tracking-wider text-fg-muted">
        Уведомления
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
        <Switch checked={on} onChange={(v) => void toggle(v)} label="Напоминать о скором уроке" hint="за час до начала" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tint/[0.06] pt-3">
          <p className="min-w-0 flex-1 text-sm text-fg-secondary">{line.text}</p>
          {line.action && (
            <Button variant={line.action === 'on' ? 'secondary' : 'ghost'} className="min-h-11 px-4 text-sm" loading={busy} onClick={() => void switchDevice()}>
              {line.action === 'on' ? 'Включить' : 'Выключить'}
            </Button>
          )}
        </div>
        {problem && <p className="text-sm text-danger-strong">{problem}</p>}
      </div>
      <p className="flex items-start gap-1.5 px-1 text-note text-fg-muted">
        <IconInfo size={14} aria-hidden className="mt-0.5 flex-none" />О переносе и отмене урока сообщим всегда.
      </p>
    </section>
  )
}
