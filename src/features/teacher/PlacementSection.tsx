// ============================================================================
// «Тест уровня» в карточке ученицы: преподаватель назначает тест, ученица его
// проходит, результат возвращается сюда.
//
// Зачем: с новой ученицей уровень неизвестен, а подбирать материалы и программу
// вслепую нельзя. Раньше оставалось попросить пройти тест на словах, причём
// результат по испанскому вообще жил в localStorage ученицы и учителю не
// показывался. Данные — lib/placement (таблица placement_requests).
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import {
  assignPlacement,
  cancelPlacement,
  listPlacements,
  type PlacementRequest,
} from '../../lib/placement'
import type { AppLang } from '../../types'

const LANGS: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'Английский' },
  { id: 'es', label: 'Испанский' },
]

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function PlacementSection({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PlacementRequest[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listPlacements(studentId).then(setRows).catch(() => setRows([]))
  }, [studentId])

  useEffect(() => {
    if (open && rows === null) load()
  }, [open, rows, load])

  const assign = async (lang: AppLang) => {
    setBusy(lang)
    setError(null)
    try {
      await assignPlacement(studentId, lang)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось назначить тест')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (id: string) => {
    setBusy(id)
    setError(null)
    try {
      await cancelPlacement(id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось снять тест')
    } finally {
      setBusy(null)
    }
  }

  const pendingIn = (lang: AppLang) =>
    (rows ?? []).some((r) => r.lang === lang && r.status === 'assigned')

  return (
    <div className="rounded-xl border border-white/[0.08]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        Тест уровня
        <span className="text-[var(--night-text-40)]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-white/[0.08] px-3 py-3">
          <p className="text-xs leading-relaxed text-[var(--night-text-40)]">
            Назначь тест, если не знаешь уровень {studentName}. Она увидит его в
            «Учёбе», а результат вернётся сюда.
          </p>

          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <Button
                key={l.id}
                variant="secondary"
                className="px-3 py-2 text-sm"
                loading={busy === l.id}
                disabled={pendingIn(l.id)}
                onClick={() => assign(l.id)}
              >
                {pendingIn(l.id) ? `${l.label} — ждём` : `Назначить · ${l.label}`}
              </Button>
            ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {rows === null ? (
            <p className="text-sm text-[var(--night-text-40)]">Загружаю…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--night-text-40)]">Тестов пока не было.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm">
                      {r.lang === 'es' ? 'Испанский' : 'Английский'}
                      {r.status === 'done' ? (
                        <span className="ml-2 font-semibold text-emerald-400">
                          {r.result_level}
                        </span>
                      ) : (
                        <span className="ml-2 text-[var(--night-text-40)]">ждём результат</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--night-text-40)]">
                      назначен {fmt(r.created_at)}
                      {r.completed_at ? ` · пройден ${fmt(r.completed_at)}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    loading={busy === r.id}
                    onClick={() => remove(r.id)}
                  >
                    {r.status === 'done' ? 'Убрать' : 'Снять'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
