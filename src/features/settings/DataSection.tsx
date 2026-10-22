// ============================================================================
// «Данные» в Настройках (макеты d14, u4; PLAN.md Ф2.17-4г-2б): «Выгрузить мои
// данные» — файл JSON со всем, что есть в аккаунте (domains/account), и
// «Удалить аккаунт» в красной рамке — диалог с паролем.
//
// Удаление (журнал п.76 (12)): сразу, после пароля. Репетитору диалог
// называет, что пропадёт: сколько учеников, до какого числа оплачен тариф и
// что деньги за оставшиеся дни не возвращаются. Удалили — выход и экран
// входа со строкой «Аккаунт удалён» (ACCOUNT_DELETED_KEY).
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ACCOUNT_DELETED_KEY, deleteMyAccount, exportFile, loadMyExport } from '../../domains/account'
import { dayLabel, loadPayInfo, planCard, planNow } from '../../domains/billing'
import { loadStudentCards } from '../../domains/students'
import { saveFile } from '../../shared/lib/download'
import { plural } from '../../shared/lib/plural'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { IconTrash } from '../../shared/ui/icons'
import { SettingsCard, ValueRow } from './settingsBits'

/** Что пропадёт у репетитора; без связи — общими словами, удаление это не держит. */
async function studioLoss(): Promise<string> {
  const [cards, pay] = await Promise.all([loadStudentCards().catch(() => null), loadPayInfo().catch(() => null)])
  const n = cards?.filter((c) => c.status !== 'archived').length ?? 0
  const who = cards ? `${n} ${plural(n, 'ученик', 'ученика', 'учеников')}, ` : ''
  const parts = [`Студия пропадёт вместе с аккаунтом: ${who}расписание, материалы. Аккаунты учеников останутся, но связь с тобой оборвётся.`]
  const now = pay ? planNow(pay) : null
  if (now?.kind === 'paid') parts.push(`Тариф «${planCard(now.plan).title}» оплачен до ${dayLabel(now.until)} — деньги за оставшиеся дни не возвращаются.`)
  return parts.join(' ')
}

export function DataSection({ teacher }: { teacher: boolean }) {
  const { user, signOutDeleted } = useAuth()
  const navigate = useNavigate()
  const { ask, dialog } = useConfirm()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setExporting(true)
    setError(null)
    try {
      const { name, text } = exportFile(await loadMyExport(), user?.email ?? null)
      saveFile(name, text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось собрать файл — попробуй ещё раз.')
    } finally {
      setExporting(false)
    }
  }

  const remove = async () => {
    setError(null)
    const loss = teacher ? await studioLoss() : null
    const ok = await ask({
      title: 'Удалить аккаунт?',
      body: (
        <>
          Сотрём слова, прогресс, домашку и переписку — вернуть их будет нельзя. {loss}
          <span className="mt-2 block">Сначала можно выгрузить данные.</span>
        </>
      ),
      action: 'Удалить навсегда',
      field: { label: 'Пароль — чтобы подтвердить', type: 'password', autoComplete: 'current-password' },
      check: async (password) => {
        if (!password) return 'Введи пароль.'
        try {
          await deleteMyAccount(user?.email ?? '', password)
          return null
        } catch (e) {
          return e instanceof Error ? e.message : 'Не получилось удалить — попробуй ещё раз.'
        }
      },
    })
    if (ok === null) return
    try {
      sessionStorage.setItem(ACCOUNT_DELETED_KEY, '1')
    } catch {
      // нет хранилища — строки на входе не будет, удаление всё равно прошло
    }
    await signOutDeleted()
    navigate('/login', { replace: true })
  }

  return (
    <SettingsCard id="data" title="Данные">
      <ValueRow
        action={
          <Button variant="outline" loading={exporting} onClick={() => void download()}>
            Выгрузить
          </Button>
        }
      >
        <span className="flex min-w-0 flex-col leading-snug">
          <span className="text-fg">Выгрузить мои данные</span>
          <small className="text-note text-fg-muted">файл со всем, что есть в аккаунте</small>
        </span>
      </ValueRow>
      {/* «опасная зона» (.dz в d14): рамка цвета danger, кнопка — контуром */}
      <div className="mt-1 @container">
        <div className="flex flex-col gap-3 rounded-control px-4 py-3.5 inset-ring-2 inset-ring-danger @md:flex-row @md:items-center" data-delete-account>
          <span className="flex flex-1 flex-col leading-snug">
            <b className="text-body font-semibold text-danger-strong">Удалить аккаунт</b>
            <small className="text-sm text-fg-secondary">Удалим аккаунт и прогресс насовсем</small>
          </span>
          <Button variant="danger-outline" onClick={() => void remove()}>
            <IconTrash size={18} aria-hidden /> Удалить аккаунт
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-strong">
          {error}
        </p>
      )}
      {dialog}
    </SettingsCard>
  )
}
