// ============================================================================
// Экран раздела карточки ученика (PLAN.md Ф2.11б-2, Ф2.17-4б-2; макеты
// d10-2…d10-4): плитка открывает раздел вместо карточки. Шапка — «‹ (АН)
// Айгерим / Диагностика», справа уровень и «осталось 3 урока», под ней
// вкладки всех разделов и «Отчёт» (лист для печати поверх). На компьютере
// шапка держится сверху панели, пока прокручиваешь раздел, список слева
// стоит. «‹» и свайп-назад возвращают к карточке (раздел в адресе,
// studioSections). «План дня» — внутри «Программы» (решение владельца
// 10.10.2026); «Отчёт родителям» — белым листом поверх, «Закрыть» — назад к
// карточке.
// ============================================================================
import type { ReactNode } from 'react'
import { balanceShort, isTracked, type Lesson, type LessonBalance } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import type { StudentDiagnostics } from '../../lib/diagnostics'
import type { StudentInfo } from '../../lib/teacher'
import { plural } from '../../shared/lib/plural'
import { Avatar } from '../../shared/ui/Avatar'
import { IconChevronLeft, IconPrinter } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { TabPicker } from '../../shared/ui/TabPicker'
import { DailyPlanSection } from './DailyPlanSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { QuestSection } from './QuestSection'
import { ReportSheet } from './ReportSheet'
import { StudentWordsSection } from './StudentWordsSection'
import { STUDIO_SECTIONS, type StudioSection } from './studioSections'
import { topicTitle, useTopicTitles } from './topicTitles'

/** Вкладки — все разделы, кроме отчёта: он справа, листом поверх. */
const TABS = STUDIO_SECTIONS.filter((s) => s.id !== 'report').map(({ id, title }) => ({ id, label: title }))

/** «осталось 3 урока» в шапке раздела; учёт не ведётся — ничего. */
function leftLabel(balance: LessonBalance | null): ReactNode {
  if (!balance || !isTracked(balance)) return null
  if (balance.balance <= 0) return <>оплаченные — {balanceShort(balance)}</>
  return (
    <>
      осталось{' '}
      <b className="font-semibold text-fg">
        {balance.balance} {plural(balance.balance, 'урок', 'урока', 'уроков')}
      </b>
    </>
  )
}

export function StudioSectionScreen({
  section,
  student,
  name,
  balance,
  last,
  wide,
  diag,
  diagError,
  onRetryDiag,
  onSection,
  onBack,
}: {
  section: StudioSection
  student: StudentInfo
  /** Имя из карточки — подпись учителя. */
  name: string
  balance: LessonBalance | null
  /** «Последнее занятие» в диагностике (lastLessonOf). */
  last: Lesson | null
  /** Компьютер: шапка держится сверху панели. */
  wide: boolean
  diag: StudentDiagnostics | null
  diagError: string | null
  onRetryDiag: () => void
  onSection: (s: StudioSection) => void
  onBack: () => void
}) {
  const { title } = STUDIO_SECTIONS.find((s) => s.id === section)!
  const id = student.profile.id
  const titles = useTopicTitles(diag)
  const level = student.profile.level ?? null
  const left = leftLabel(balance)

  return (
    <section aria-label={title} data-studio-section={section} className="flex flex-1 flex-col">
      <header className={`z-10 flex flex-col gap-2.5 border-b border-line ${wide ? 'sticky top-0 bg-surface px-4 pt-3.5' : ''}`}>
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            data-section-back
            aria-label={`Назад к карточке: ${name}`}
            className="-ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-control-sm pl-1 pr-2 text-body font-medium text-accent-strong active:bg-ghost-press"
          >
            <IconChevronLeft size={20} aria-hidden className="flex-none" />
            <Avatar name={name} size={32} />
            <span className="truncate">{firstName(name)}</span>
          </button>
          <span aria-hidden className="text-lg text-fg-faint">
            /
          </span>
          <h2 className="truncate text-xl font-semibold text-fg">{title}</h2>
          {(level || left) && (
            <span className="ml-auto hidden flex-none items-center gap-1.5 text-note text-fg-secondary @lg:flex">
              {level && <span className="rounded-full bg-input px-2 py-0.5 text-xs font-semibold text-fg-secondary">{level}</span>}
              {left}
            </span>
          )}
        </div>
        <TabPicker
          variant="line"
          options={TABS}
          value={section === 'report' ? 'diag' : section}
          onChange={onSection}
          ariaLabel="Разделы ученика"
          className="-mx-1"
          trailing={
            <button
              type="button"
              onClick={() => onSection('report')}
              aria-label="Отчёт родителям — лист для печати"
              className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-2.5 text-body font-medium text-fg-secondary hover:text-fg"
            >
              Отчёт <IconPrinter size={18} aria-hidden className="text-fg-muted" />
            </button>
          }
        />
      </header>

      <div className={`flex flex-1 flex-col gap-3.5 ${wide ? 'p-4' : 'pt-4'}`}>
        {section === 'placement' && <PlacementSection studentId={id} studentName={name} />}
        {section === 'diag' && <DiagnosticsSection studentId={id} name={name} preloaded={diag} last={last} />}
        {section === 'program' && (
          <>
            <ProgramSection studentId={id} />
            <h3 className="mt-2 font-semibold">План дня</h3>
            <DailyPlanSection studentId={id} />
          </>
        )}
        {section === 'words' && <StudentWordsSection studentId={id} studentName={name} studentLevel={level} />}
        {section === 'quests' && <QuestSection studentId={id} studentName={name} />}
        {section === 'report' &&
          (diag ? (
            <ReportSheet
              studentId={id}
              diag={diag}
              studentName={name}
              topicTitle={(lang, topicId) => topicTitle(titles, lang, topicId)}
              onClose={onBack}
            />
          ) : diagError ? (
            <LoadError message={diagError} onRetry={onRetryDiag} />
          ) : (
            <p className="text-sm text-fg-muted">Собираю отчёт…</p>
          ))}
      </div>
    </section>
  )
}
