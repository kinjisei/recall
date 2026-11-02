// ============================================================================
// Печатная версия материала (фаза C). Рендерится порталом в body (вне #root):
// при печати CSS прячет приложение и остаётся только этот лист.
// Два режима: для ученика (без ответов) и для учителя (с ключом).
// «Сохранить в PDF» — стандартный диалог печати браузера.
// Каждый вид — с местом для ответа (Ф2.25-1б): «Соедини пары» — слова с
// номером и пропуском, справа варианты с буквой в том же порядке, что у
// ученика на экране (ключ «1–b, 2–d» сходится и с экраном); «Верно /
// Неверно» — кнопки на языке текста, обвести; «Собери предложение» — слова
// вперемешку и строка (раньше печатался только перевод, а ключ был пуст).
// ============================================================================
import { createPortal } from 'react-dom'
import { Button } from '../../shared/ui/Button'
import { IconPrinter } from '../../shared/ui/icons'
import { rightColumn } from '../../components/MatchExercise'
import type { Material, MaterialExercise } from '../../types'

// с запасом: у пар справа до 10 вариантов (8 пар и 2 лишних) — лишние
// не должны печататься как «undefined)»
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

/** Ключ упражнения строкой: «b) at seven», «1–b, 2–d, 3–a», «I go home». */
function keyOf(ex: MaterialExercise): string {
  if (ex.type === 'mcq') return `${LETTERS[ex.answer]}) ${ex.options[ex.answer]}`
  if (ex.type === 'fill') return ex.answer
  if (ex.type === 'order') return ex.answer.join(' ')
  const rights = rightColumn(ex)
  return ex.pairs.map((p, k) => `${k + 1}–${LETTERS[rights.indexOf(p.right)]}`).join(', ')
}

/** Слова «собери предложение» вперемешку, но одинаково при каждой печати: по алфавиту. */
const bank = (words: string[]) => [...words].sort((a, b) => a.localeCompare(b)).join(' / ')

export function PrintSheet({
  material,
  withAnswers,
  onClose,
}: {
  material: Material
  withAnswers: boolean
  onClose: () => void
}) {
  const m = material

  return createPortal(
    <div data-theme="light" className="print-sheet fixed inset-0 z-50 overflow-auto bg-surface px-8 py-6 text-fg">
      <div className="no-print mb-5 flex items-center gap-2 border-b border-line pb-4">
        <Button size="sm" onClick={() => window.print()}>
          <IconPrinter size={16} /> Печать / Сохранить в PDF
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
        <span className="text-xs text-fg-muted">
          {withAnswers ? 'версия с ответами (для учителя)' : 'версия для ученика'}
        </span>
      </div>

      <div className="mx-auto max-w-2xl font-serif leading-relaxed">
        <h1 className="text-2xl font-bold">{m.title ?? m.topic}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {m.lang === 'es' ? 'Español' : 'English'} · {m.level} · {m.format}
          {'  '}·{'  '}Name: ______________________ Date: ____________
        </p>

        <div className="mt-5 whitespace-pre-wrap text-[15px]">{m.body}</div>

        <h2 className="mt-7 border-t border-line pt-4 text-lg font-bold">
          Exercises
        </h2>
        <ol className="mt-2 flex flex-col gap-4">
          {m.exercises.map((ex, i) => (
            <li key={i} className="text-[15px]">
              <p>
                <span className="font-semibold">{i + 1}.</span> {ex.prompt}
              </p>
              {ex.type === 'mcq' && (
                <p className="mt-1 pl-5 text-fg-secondary">
                  {ex.options.map((opt, oi) => (
                    <span key={oi} className="mr-5 whitespace-nowrap">
                      {LETTERS[oi]}) {opt}
                    </span>
                  ))}
                </p>
              )}
              {ex.type === 'fill' && (
                <p className="mt-1 pl-5 text-sm text-fg-muted">
                  Answer: ______________________________
                  {ex.hint ? `   (${ex.hint})` : ''}
                </p>
              )}
              {ex.type === 'order' && (
                <>
                  <p className="mt-1 pl-5 text-fg-secondary">( {bank(ex.words)} )</p>
                  <p className="mt-1 pl-5 text-sm text-fg-muted">______________________________________________</p>
                </>
              )}
              {ex.type === 'match' && (
                <div className="mt-1 grid grid-cols-2 gap-x-8 pl-5 text-fg-secondary">
                  <ol>
                    {ex.pairs.map((p, k) => (
                      <li key={k}>
                        {k + 1}. {p.left} ____
                      </li>
                    ))}
                  </ol>
                  <ul>
                    {rightColumn(ex).map((r, k) => (
                      <li key={k}>
                        {LETTERS[k]}) {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>

        {withAnswers && (
          <>
            <h2 className="mt-7 border-t border-line pt-4 text-lg font-bold">
              Ключ (для учителя)
            </h2>
            <ol className="mt-2 flex flex-col gap-1 text-[15px]">
              {m.exercises.map((ex, i) => (
                <li key={i}>
                  <span className="font-semibold">{i + 1}.</span>{' '}
                  {keyOf(ex)}
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="mt-8 border-t border-line pt-3 text-xs text-fg-muted">
          Recall · {new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty' })}
        </p>
      </div>
    </div>,
    document.body,
  )
}
