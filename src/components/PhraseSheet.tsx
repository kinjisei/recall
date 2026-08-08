// ============================================================================
// Шторка ВЫДЕЛЕННОЙ ФРАЗЫ (режим «Выделить фразу»): полный перевод фрагмента
// (lib/phrase — правильный промпт, не «словарная форма»), озвучка, «в колоду»,
// «Разбор предложения». Для одного слова используется WordSheet (контекстный
// словарь + транскрипция), для фразы — эта шторка.
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconSpeaker } from './icons'
import { AnalysisSheet } from './AnalysisSheet'
import { translatePhrase } from '../lib/phrase'
import { addCard } from '../lib/cards'
import { speak } from '../lib/speech'
import { logActivity } from '../lib/activity'
import type { AppLang } from '../types'

export interface PhrasePick {
  text: string
  sentence: string
}

export function PhraseSheet({
  text,
  sentence,
  lang,
  onClose,
}: {
  text: string
  sentence: string
  lang: AppLang
  onClose: () => void
}) {
  const [tr, setTr] = useState<string | null>(null)
  // текст причины, а не флаг — см. AnalysisSheet
  const [failed, setFailed] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [analyze, setAnalyze] = useState(false)

  useEffect(() => {
    let alive = true
    setTr(null)
    setFailed(null)
    setAdded(false)
    translatePhrase(text, lang)
      .then((r) => {
        if (!alive) return
        if (r) setTr(r)
        else setFailed('Не удалось перевести — можно добавить как есть.')
      })
      .catch((e) => alive && setFailed(e instanceof Error ? e.message : 'Не удалось перевести — можно добавить как есть.'))
    return () => {
      alive = false
    }
  }, [text, lang])

  const add = async () => {
    if (busy || added) return
    setBusy(true)
    try {
      await addCard({ front: text, back: tr ?? undefined, example: sentence, lang, source: 'reader' })
      setAdded(true)
      void logActivity('reader')
    } catch {
      /* оставим кнопку активной для повтора */
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
        <div
          className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />
          <div className="min-h-0 overflow-y-auto px-5 pt-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Фраза</p>
                <p className="mt-0.5 text-[15px] font-medium leading-snug">{text}</p>
              </div>
              <button
                onClick={() => speak(text, { lang })}
                aria-label="Озвучить"
                className="lift flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/[0.08] text-[var(--night-text-70)]"
              >
                <IconSpeaker size={16} />
              </button>
            </div>

            {tr === null && !failed && (
              <p className="mt-3 text-sm text-[var(--night-text-40)]">Перевожу…</p>
            )}
            {failed && <p className="mt-3 text-sm text-[var(--night-text-40)]">{failed}</p>}
            {tr && (
              <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[15px] leading-relaxed text-[var(--night-text)]">
                {tr}
              </p>
            )}

            <button
              onClick={() => setAnalyze(true)}
              className="lift mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.10)] py-2.5 text-sm font-medium text-[var(--night-accent-100)]"
            >
              🔍 Разбор предложения
            </button>
          </div>

          <div className="flex shrink-0 gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {added ? (
              <Button variant="secondary" className="flex-1" disabled>
                Добавлено ✓
              </Button>
            ) : (
              <Button className="flex-1" onClick={add} disabled={busy}>
                {busy ? 'Добавляю…' : '+ В мои слова'}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
      {analyze && (
        <AnalysisSheet text={text} sentence={sentence} lang={lang} onClose={() => setAnalyze(false)} />
      )}
    </>,
    document.body,
  )
}
