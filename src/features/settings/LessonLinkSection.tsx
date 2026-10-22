// ============================================================================
// «Уроки» в Настройках репетитора (макеты d14-1, u4-2; журнал п.43): ссылка
// на урок по умолчанию — она подставляется в новые уроки, у урока или группы
// её можно поменять. Раньше задать её можно было только в форме урока
// (первая введённая становилась ссылкой по умолчанию), а поменять — нигде.
// «Изменить ссылку» открывает поле прямо в строке; пустое поле убирает
// ссылку. Проверяет и чистит адрес база (`set_default_lesson_link`,
// `lesson_link_clean`); без тарифа — её отказ словами (RECALL_PLAN_REQUIRED).
// ============================================================================
import { useState, type FormEvent } from 'react'
import { loadDefaultLessonLink, saveDefaultLessonLink } from '../../domains/schedule'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { IconLink } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { Field, fieldClass } from '../../shared/ui/TextField'
import { SettingsCard, ValueRow } from './settingsBits'

export function LessonLinkSection() {
  const link = useAsyncData(loadDefaultLessonLink, [], 'Не удалось загрузить ссылку на урок')
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveDefaultLessonLink(value.trim())
      setEditing(false)
      link.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить ссылку')
    } finally {
      setBusy(false)
    }
  }

  const current = link.data ?? null
  return (
    <SettingsCard id="lessons" title="Уроки" note="Подставляется в новые уроки; у урока или группы можно поменять">
      {link.error ? (
        <LoadError message={link.error} onRetry={link.reload} />
      ) : link.loading ? (
        <RowsSkeleton count={1} height={52} />
      ) : editing ? (
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2.5" data-lesson-link-form>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-secondary">Ссылка на урок по умолчанию</span>
            <input
              autoFocus
              inputMode="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="meet.google.com/abc-defg-hij"
              className={fieldClass(!!error)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger-strong">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              Сохранить
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <Field label="Ссылка на урок по умолчанию">
          <ValueRow
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setValue(current ?? '')
                  setEditing(true)
                }}
              >
                {current ? 'Изменить ссылку' : 'Добавить ссылку'}
              </Button>
            }
          >
            <IconLink size={18} aria-hidden className="flex-none text-fg-muted" />
            <span className={`truncate ${current ? 'text-fg' : 'text-fg-muted'}`} data-lesson-link>
              {current ? current.replace(/^https?:\/\//, '') : 'не задана — первая ссылка из урока станет ею'}
            </span>
          </ValueRow>
        </Field>
      )}
    </SettingsCard>
  )
}
