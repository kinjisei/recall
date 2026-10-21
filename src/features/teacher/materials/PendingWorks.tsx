// ============================================================================
// «На проверку: 1» над библиотекой (макет d8-1 `.rev8`): кто сдал задание по
// материалу — «Әсел Жұмабаева · «My morning»», «задание по материалу ·
// вчера, 9:10» и «Проверить». Нажал строку — та же проверка, что из хаба
// «Заданий» (`?work=`, листалка «Работа 1 из 2»), а «назад» — сюда.
// Работ несколько — метка над строками, уже 448 px — тоже над ними, а вместо
// кнопки — стрелка.
// ============================================================================
import { whenDone } from '../../../domains/schedule'
import type { SubmittedWork } from '../../../lib/reviewQueue'
import { Avatar } from '../../../shared/ui/Avatar'
import { buttonClass } from '../../../shared/ui/Button'
import { IconChevronRight } from '../../../shared/ui/icons'

function Tag({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`flex-none whitespace-nowrap rounded-full bg-warning-soft px-2.5 py-0.5 text-note font-semibold text-warning-soft-fg ${className}`}>
      На проверку: {n}
    </span>
  )
}

export function PendingWorks({ works, onCheck }: { works: readonly SubmittedWork[]; onCheck: (w: SubmittedWork) => void }) {
  if (works.length === 0) return null
  const many = works.length > 1
  return (
    <section aria-label="На проверку" className="@container flex flex-col overflow-hidden rounded-row bg-surface shadow-card">
      <Tag n={works.length} className={`ml-4.5 mt-3 self-start ${many ? '' : '@md:hidden'}`} />
      {works.map((w, i) => (
        <button
          key={w.assignment.id}
          type="button"
          data-row
          onClick={() => onCheck(w)}
          className={`flex items-center gap-3.5 py-3 pl-4.5 pr-3.5 text-left transition-colors duration-(--dur-1) hover:bg-row-press active:bg-row-press ${i > 0 ? 'border-t border-line' : ''}`}
        >
          {!many && <Tag n={1} className="hidden @md:inline-flex" />}
          <Avatar name={w.studentName} size={36} />
          <span className="flex min-w-0 flex-1 flex-col leading-snug">
            <b className="truncate text-body font-semibold text-fg">
              {w.studentName} · «{w.material.title ?? w.material.topic}»
            </b>
            <span className="truncate text-sm text-fg-muted">
              {['задание по материалу', whenDone(w.assignment.submitted_at)].filter(Boolean).join(' · ')}
            </span>
          </span>
          {/* узко — стрелка, как в строках t1-3: нажимается вся строка, а тексту нужно место */}
          <span aria-hidden className="hidden flex-none @md:block">
            <span className={`${buttonClass('secondary', 'sm')} px-4`}>Проверить</span>
          </span>
          <IconChevronRight size={20} aria-hidden className="flex-none text-fg-faint @md:hidden" />
        </button>
      ))}
    </section>
  )
}
