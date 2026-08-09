// ============================================================================
// Лист «Разбор всего текста»: оценка стоимости → подтверждение → прогресс →
// итог (уровень + почему + «что возьмёшь» + найденное). Кэш локальный:
// повторное открытие мгновенно и бесплатно, «Разобрать заново» — платно.
// Движок — lib/textAnalysis (Заход 2a).
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconRefresh } from './icons'
import { AnalyzedItemsView } from './AnalyzedItemsView'
import { analyzeText, type TextAnalysis } from '../lib/textAnalysis'
import { estimateCost } from '../lib/textChunks'
import {
  getCachedTextAnalysis,
  setCachedTextAnalysis,
  clearCachedTextAnalysis,
} from '../lib/textAnalysisCache'
import type { AppLang } from '../types'

export function TextAnalysisSheet({
  text,
  lang,
  onClose,
}: {
  text: string
  lang: AppLang
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'confirm' | 'loading' | 'result' | 'error'>('confirm')
  // причина отказа от сервера — показываем её, а не общее «попробуй ещё раз»
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TextAnalysis | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: estimateCost(text) })

  // если разбор уже в кэше — показываем сразу и бесплатно
  useEffect(() => {
    const cached = getCachedTextAnalysis(lang, text)
    if (cached) {
      setData(cached)
      setPhase('result')
    }
  }, [lang, text])

  const run = async () => {
    setPhase('loading')
    setProgress({ done: 0, total: estimateCost(text) })
    try {
      const r = await analyzeText(text, lang, (done, total) => setProgress({ done, total }))
      setCachedTextAnalysis(lang, text, r)
      setData(r)
      setPhase('result')
    } catch (e) {
      // причину не теряем: сервер объясняет, что именно случилось
      setError(e instanceof Error ? e.message : null)
      setPhase('error')
    }
  }

  const redo = () => {
    clearCachedTextAnalysis(lang, text)
    setData(null)
    setPhase('confirm')
  }

  const cost = estimateCost(text)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />
        <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
            Разбор всего текста
          </p>

          {phase === 'confirm' && (
            <div className="mt-3 flex flex-col gap-3">
              {/* Единица — та же, что на полоске «Энергия AI»: раньше здесь
                  считали «AI-действия», и человек сверял цену с числом,
                  которого нигде на экране нет (находка ревью 2В). */}
              <p className="text-sm leading-relaxed text-[var(--night-text-70)]">
                Разберу весь текст: уровень, ключевую лексику, фразовые глаголы и
                грамматику. Спишется примерно <b>{cost} ⚡</b> из дневной энергии.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={run}>
                  Разобрать
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="mt-4">
              <p className="text-sm text-[var(--night-text-40)]">
                Разбираю текст… {progress.done}/{progress.total}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full origin-left rounded-full bg-[var(--night-accent)] transition-transform duration-300"
                  style={{
                    transform: `scaleX(${progress.total ? progress.done / progress.total : 0})`,
                  }}
                />
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-red-400">
                {error ?? 'Не удалось разобрать. Попробуй ещё раз.'}
              </p>
              <Button className="w-full" onClick={run}>
                Повторить
              </Button>
            </div>
          )}

          {phase === 'result' && data && (
            <>
              <p className="mt-2 text-lg font-semibold">Уровень: {data.level || '—'}</p>
              {data.why && <p className="mt-0.5 text-sm text-[var(--night-text-40)]">{data.why}</p>}
              {data.takeaway && (
                <p className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-[var(--night-text-70)]">
                  💡 {data.takeaway}
                </p>
              )}
              <AnalyzedItemsView items={data.items} lang={lang} onClose={onClose} />
              <button
                onClick={redo}
                className="lift mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.10] py-2.5 text-sm text-[var(--night-text-40)]"
              >
                <IconRefresh size={15} /> Разобрать заново
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
