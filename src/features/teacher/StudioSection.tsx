// ============================================================================
// Экран раздела карточки ученика (PLAN.md Ф2.11б-2): плитка открывает раздел
// вместо карточки — «‹ Имя» возвращает к ней (и свайп-назад: раздел в адресе,
// studioSections). На телефоне — экраном, на компьютере — в панели справа.
// «План дня» — внутри «Программы» (решение владельца 10.10.2026); «Отчёт
// родителям» — белым листом поверх (печать), «Закрыть» — назад к карточке.
// ============================================================================
import type { StudentDiagnostics } from '../../lib/diagnostics'
import type { StudentInfo } from '../../lib/teacher'
import { IconBack } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { DailyPlanSection } from './DailyPlanSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { QuestSection } from './QuestSection'
import { ReportSheet } from './ReportSheet'
import { StudentWordsSection } from './StudentWordsSection'
import { STUDIO_SECTIONS, type StudioSection } from './studioSections'
import { topicTitle, useTopicTitles } from './topicTitles'

export function StudioSectionScreen({
  section,
  student,
  name,
  diag,
  diagError,
  onRetryDiag,
  onBack,
}: {
  section: StudioSection
  student: StudentInfo
  /** Имя из карточки — подпись учителя. */
  name: string
  diag: StudentDiagnostics | null
  diagError: string | null
  onRetryDiag: () => void
  onBack: () => void
}) {
  const { title, Icon } = STUDIO_SECTIONS.find((s) => s.id === section)!
  const id = student.profile.id
  const titles = useTopicTitles(diag)

  return (
    <div className="flex flex-col gap-4" data-studio-section={section}>
      <button
        type="button"
        onClick={onBack}
        data-section-back
        className="-ml-2 flex min-h-11 max-w-full items-center gap-1 self-start rounded-xl px-2 text-accent-strong"
      >
        <IconBack size={20} className="flex-none" /> <span className="truncate">{name}</span>
      </button>
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <Icon size={24} className="flex-none text-accent-strong" aria-hidden /> {title}
      </h2>

      {section === 'placement' && <PlacementSection studentId={id} studentName={name} />}
      {section === 'diag' && <DiagnosticsSection studentId={id} preloaded={diag} />}
      {section === 'program' && (
        <>
          <ProgramSection studentId={id} />
          <h3 className="mt-2 font-semibold">План дня</h3>
          <DailyPlanSection studentId={id} />
        </>
      )}
      {section === 'words' && <StudentWordsSection studentId={id} studentLevel={student.profile.level ?? null} />}
      {section === 'quests' && <QuestSection studentId={id} />}
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
  )
}
