// ============================================================================
// «Данные и аккаунт» в Настройках (хвост блока 5): скачать свои данные и
// удалить аккаунт. Удаление необратимо, поэтому подтверждается вводом своего
// email (как «type to confirm» у GitHub): случайно не нажмёшь, и чужой открытый
// ноутбук не сотрёт аккаунт одним тапом.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { downloadMyData, deleteMyAccount } from '../../lib/account'

export function DataAccountSection() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const email = user?.email ?? ''

  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  const canDelete = typed.trim().toLowerCase() === email.toLowerCase() && email !== ''

  const onExport = async () => {
    setExporting(true)
    setExportErr(null)
    try {
      await downloadMyData()
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : 'Не удалось собрать данные')
    } finally {
      setExporting(false)
    }
  }

  const onDelete = async () => {
    if (!canDelete || deleting) return
    setDeleting(true)
    setDeleteErr(null)
    try {
      await deleteMyAccount()
      navigate('/login', { replace: true })
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Не удалось удалить аккаунт')
      setDeleting(false)
    }
  }

  return (
    <section
      className="animate-fade-up rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4"
      style={{ animationDelay: '.28s' }}
    >
      <h2 className="mb-3 font-medium">Данные и аккаунт</h2>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-[var(--night-text-70)]">
          Скачать всё, что хранится по аккаунту: профиль, слова с прогрессом,
          письменные работы, историю занятий и диалогов — одним файлом JSON.
        </p>
        <Button variant="secondary" className="self-start" onClick={onExport} loading={exporting}>
          {exporting ? 'Собираю…' : 'Скачать мои данные'}
        </Button>
        {exportErr && <p className="text-sm text-red-400">{exportErr}</p>}
      </div>

      <div className="mt-5 border-t border-white/[0.08] pt-4">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="min-h-11 text-sm font-medium text-red-400 hover:text-red-300"
          >
            Удалить аккаунт
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--night-text-70)]">
              Это сотрёт аккаунт и все данные без возврата. Если уверен — введи
              свой email <span className="font-medium text-[var(--night-text)]">{email}</span> и
              нажми «Удалить навсегда».
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              autoComplete="off"
              className="h-11 rounded-xl border border-white/[0.12] bg-[var(--night-input)] px-3.5 text-sm outline-none focus:border-red-500/60"
            />
            {deleteErr && <p className="text-sm text-red-400">{deleteErr}</p>}
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                disabled={!canDelete || deleting}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-[filter,transform] active:scale-[0.98] disabled:opacity-40"
              >
                {deleting ? 'Удаляю…' : 'Удалить навсегда'}
              </button>
              <button
                onClick={() => {
                  setConfirming(false)
                  setTyped('')
                  setDeleteErr(null)
                }}
                className="min-h-11 rounded-xl border border-white/[0.12] px-4 text-sm text-[var(--night-text-70)]"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
