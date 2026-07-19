// ============================================================================
// Печатная версия материала (фаза C). Рендерится порталом в body (вне #root):
// при печати CSS прячет приложение и остаётся только этот лист.
// Два режима: для ученика (без ответов) и для учителя (с ключом).
// «Сохранить в PDF» — стандартный диалог печати браузера.
// ============================================================================
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import type { Material } from '../../types'

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']

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
    <div className="print-sheet fixed inset-0 z-50 overflow-auto bg-white px-8 py-6 text-black">
      <div className="no-print mb-5 flex items-center gap-2 border-b border-slate-200 pb-4">
        <Button className="px-4 py-2 text-sm" onClick={() => window.print()}>
          🖨 Печать / Сохранить в PDF
        </Button>
        <Button variant="secondary" className="px-4 py-2 text-sm" onClick={onClose}>
          Закрыть
        </Button>
        <span className="text-xs text-slate-400">
          {withAnswers ? 'версия с ответами (для учителя)' : 'версия для ученика'}
        </span>
      </div>

      <div className="mx-auto max-w-2xl font-serif leading-relaxed">
        <h1 className="text-2xl font-bold">{m.title ?? m.topic}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {m.lang === 'es' ? 'Español' : 'English'} · {m.level} · {m.format}
          {'  '}·{'  '}Name: ______________________ Date: ____________
        </p>

        <div className="mt-5 whitespace-pre-wrap text-[15px]">{m.body}</div>

        <h2 className="mt-7 border-t border-neutral-300 pt-4 text-lg font-bold">
          Exercises
        </h2>
        <ol className="mt-2 flex flex-col gap-4">
          {m.exercises.map((ex, i) => (
            <li key={i} className="text-[15px]">
              <p>
                <span className="font-semibold">{i + 1}.</span> {ex.prompt}
              </p>
              {ex.type === 'mcq' && (
                <p className="mt-1 pl-5 text-neutral-800">
                  {ex.options.map((opt, oi) => (
                    <span key={oi} className="mr-5 whitespace-nowrap">
                      {LETTERS[oi]}) {opt}
                    </span>
                  ))}
                </p>
              )}
              {ex.type === 'fill' && (
                <p className="mt-1 pl-5 text-sm text-neutral-500">
                  Answer: ______________________________
                  {ex.hint ? `   (${ex.hint})` : ''}
                </p>
              )}
            </li>
          ))}
        </ol>

        {withAnswers && (
          <>
            <h2 className="mt-7 border-t border-neutral-300 pt-4 text-lg font-bold">
              Ключ (для учителя)
            </h2>
            <ol className="mt-2 flex flex-col gap-1 text-[15px]">
              {m.exercises.map((ex, i) => (
                <li key={i}>
                  <span className="font-semibold">{i + 1}.</span>{' '}
                  {ex.type === 'mcq'
                    ? `${LETTERS[ex.answer]}) ${ex.options[ex.answer]}`
                    : ex.type === 'fill'
                      ? ex.answer
                      : ''}
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="mt-8 border-t border-neutral-200 pt-3 text-xs text-neutral-400">
          Recall · {new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    </div>,
    document.body,
  )
}
