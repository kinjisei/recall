// ============================================================================
// Библиотека материалов (макет d8-1 `.ls8`, PLAN.md Ф2.17-4в-2): одна
// карточка, внутри уровни «A2 · 3» и строки — название и «120 слов · 2 упр.»,
// под ним «Английский · A2 · рассказ · 1 на проверке»; выбранная — подложка
// accent-soft и рамка фокуса. Внутри уровня — свежие сверху. Раньше уровни
// сворачивались раскрывашками, а каждый материал был своей карточкой; на
// компьютере список стоит рядом с текстом и прокручивается сам.
// Строка своя, а не RowCard: у d8-1 выбранная — рамкой внутри общей карточки,
// справа в строке названия — тихая подпись, а у RowCard — полоска слева и
// число полужирным (d3); тот же вид ждёт список писем d9-1.
// ============================================================================
import { plural } from '../../../shared/lib/plural'
import type { AppLang, Material } from '../../../types'
import { wordCount } from '../../writing'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const LANG_NAME: Record<AppLang, string> = { en: 'Английский', es: 'Испанский' }

/** «Английский · A2 · рассказ» — строка материала в списке и в подробностях. */
export const materialKind = (m: Material): string => [LANG_NAME[m.lang] ?? m.lang, m.level, m.format].filter(Boolean).join(' · ')

/** «120 слов» — по самому тексту, а не по заказанной длине «100-250». */
export const materialWords = (m: Material): string => {
  const n = wordCount(m.body)
  return `${n} ${plural(n, 'слово', 'слова', 'слов')}`
}

export function LibraryList({
  materials,
  pending,
  selectedId,
  onOpen,
}: {
  materials: Material[]
  /** Сколько сданных работ ждёт проверки — по материалу. */
  pending: ReadonlyMap<string, number>
  selectedId: string | null
  onOpen: (m: Material) => void
}) {
  const groups = LEVELS.map((level) => ({ level, items: materials.filter((m) => m.level === level) })).filter((g) => g.items.length > 0)
  // материалы с нестандартным уровнем не прячем
  const other = materials.filter((m) => !LEVELS.includes(m.level))
  if (other.length > 0) groups.push({ level: 'Другое', items: other })

  return (
    <nav aria-label="Материалы" className="flex min-h-full flex-col overflow-hidden rounded-card bg-surface pb-2 shadow-card">
      {groups.map(({ level, items }) => (
        <div key={level} className="flex flex-col">
          <h2 className="px-4.5 pb-1.5 pt-3.5 text-note font-semibold text-fg-muted">
            {level} · {items.length}
          </h2>
          {items.map((m, i) => {
            const sel = m.id === selectedId
            // черта над строкой — кроме первой в уровне и той, что под выбранной (d8-1 `.r8`)
            const line = i > 0 && items[i - 1]?.id !== selectedId && !sel
            const waiting = pending.get(m.id) ?? 0
            return (
              <button
                key={m.id}
                type="button"
                data-row
                aria-current={sel || undefined}
                onClick={() => onOpen(m)}
                className={`mx-2 flex flex-col gap-0.5 rounded-control-sm border-t px-3 py-2.5 text-left transition-colors duration-(--dur-1) ${
                  sel ? 'border-transparent bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : `text-fg hover:bg-row-press active:bg-row-press ${line ? 'border-line' : 'border-transparent'}`
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <b lang={m.lang} className="min-w-0 flex-1 truncate text-base font-semibold">
                    {m.title ?? m.topic}
                  </b>
                  <span className={`flex-none whitespace-nowrap text-note tabular-nums ${sel ? '' : 'text-fg-muted'}`}>
                    {materialWords(m)} · {m.exercises.length} упр.
                  </span>
                </span>
                <span className={`text-sm ${sel ? '' : 'text-fg-secondary'}`}>
                  {materialKind(m)}
                  {waiting > 0 && (
                    <>
                      {' · '}
                      <span className="font-medium text-warning-strong">{waiting} на проверке</span>
                    </>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
