// ============================================================================
// «Тест уровня» в карточке ученика (макет d11-1): преподаватель назначает
// тест, ученик его проходит, результат возвращается сюда.
//
// Зачем: с новым учеником уровень неизвестен, а подбирать материалы и программу
// вслепую нельзя. Раньше оставалось попросить пройти тест на словах, причём
// результат по испанскому вообще жил в localStorage ученика и учителю не
// показывался. Данные — lib/placement (таблица placement_requests).
//
// Сверху — строка «Тест появится у ученика в «Учёбе»…», карточка «Назначить
// тест уровня»: главная кнопка — на языке, который учитель преподаёт (EN/ES),
// второй язык — тихой. Пока назначенный тест не пройден, вместо кнопки —
// «Назначен 10 окт · ждёт»: второй тест поверх ждущего не назначить. Ниже —
// «История» (ждёт / уровень, когда назначен и пройден, «Снять» / «Убрать»);
// тестов не было — одна строка «Тестов пока не было».
// ============================================================================
import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { dateAt } from '../../domains/schedule'
import { assignPlacement, cancelPlacement, listPlacements, type PlacementRequest } from '../../lib/placement'
import { plural } from '../../shared/lib/plural'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { Button } from '../../shared/ui/Button'
import { IconInfo } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import type { AppLang } from '../../types'
import { SectionCard } from './sectionBits'

const LANG_LABEL: Record<AppLang, string> = { en: 'Английский', es: 'Испанский' }

export function PlacementSection({ studentId }: { studentId: string }) {
  const { lang: mine } = useLanguage()
  const other: AppLang = mine === 'en' ? 'es' : 'en'
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // сбой загрузки ≠ «тестов не было»: иначе учитель не отличит одно от другого
  const { data: rows, error: loadError, reload: load } = useAsyncData(() => listPlacements(studentId), [studentId], 'Не удалось загрузить тесты')

  const run = async (key: string, act: () => Promise<void>, fail: string) => {
    setBusy(key)
    setError(null)
    try {
      await act()
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : fail)
    } finally {
      setBusy(null)
    }
  }
  const assign = (l: AppLang) => run(l, () => assignPlacement(studentId, l), 'Не удалось назначить тест')
  const remove = (id: string) => run(id, () => cancelPlacement(id), 'Не удалось снять тест')

  const waiting = (l: AppLang) => (rows ?? []).find((r) => r.lang === l && r.status === 'assigned') ?? null
  const mineWaits = waiting(mine)
  const otherWaits = waiting(other)

  return (
    <>
      <p className="flex items-start gap-2.5 text-body text-fg-secondary">
        <IconInfo size={18} aria-hidden className="mt-0.5 flex-none text-fg-muted" />
        Тест появится у ученика в «Учёбе», а результат вернётся сюда
      </p>

      <SectionCard title="Назначить тест уровня">
        <div className="flex flex-wrap items-center gap-3">
          {/* до загрузки не знаем, ждёт ли тест, — кнопка выключена, а не зовёт назначить второй */}
          <Button size="md" className="px-5" loading={busy === mine} disabled={rows === null || !!mineWaits} onClick={() => void assign(mine)}>
            {mineWaits ? `Назначен ${dateAt(mineWaits.created_at)} · ждёт` : `Назначить · ${LANG_LABEL[mine]}`}
          </Button>
          <Button variant="ghost" loading={busy === other} disabled={rows === null || !!otherWaits} onClick={() => void assign(other)}>
            {otherWaits ? `${LANG_LABEL[other]} · назначен ${dateAt(otherWaits.created_at)} · ждёт` : `Другой язык · ${LANG_LABEL[other]}`}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-strong">
            {error}
          </p>
        )}
      </SectionCard>

      {loadError ? (
        <LoadError message={loadError} onRetry={load} />
      ) : rows === null ? (
        <RowsSkeleton count={2} height={60} />
      ) : rows.length === 0 ? (
        <p className="px-1 text-body text-fg-muted" data-placement-empty>
          Тестов пока не было
        </p>
      ) : (
        <SectionCard title="История" note={`${rows.length} ${plural(rows.length, 'тест', 'теста', 'тестов')}`}>
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((r) => (
              <HistoryRow key={r.id} r={r} busy={busy === r.id} onRemove={() => void remove(r.id)} />
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  )
}

/** Строка «История» (d11-1 `.hr11`): «…» или уровень, язык и итог, даты, «Снять» / «Убрать». */
function HistoryRow({ r, busy, onRemove }: { r: PlacementRequest; busy: boolean; onRemove: () => void }) {
  const done = r.status === 'done'
  return (
    <li className="flex min-h-15 items-center gap-3 py-1.5" data-placement-row={r.status}>
      <span
        aria-hidden
        className={`flex h-11 min-w-11 flex-none items-center justify-center rounded-xl px-2 text-base font-bold ${done ? 'bg-success-soft text-success-soft-fg' : 'bg-input text-fg-secondary'}`}
      >
        {done ? r.result_level : '…'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <b className="text-body font-semibold text-fg">
          {LANG_LABEL[r.lang]} · {done ? r.result_level : 'ещё не пройден'}
        </b>
        <span className="text-note text-fg-secondary">
          назначен {dateAt(r.created_at)}
          {r.completed_at ? ` · пройден ${dateAt(r.completed_at)}` : ''}
        </span>
      </span>
      <Button variant="outline" loading={busy} onClick={onRemove}>
        {done ? 'Убрать' : 'Снять'}
      </Button>
    </li>
  )
}
