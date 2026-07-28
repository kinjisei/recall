// ============================================================================
// Текст с двумя режимами работы со словами (вся логика читалок в одном месте):
//   • обычный тап — шторка перевода одного слова (WordSheet), long-press — фраза;
//   • режим «Отметить слова» — тапы помечают слова, снизу плавающая панель
//     «В колоду (N)»: ОДИН AI-запрос переводит всю пачку (lib/batchWords).
// Используется в читалках EN/ES, «Моих текстах» и заданиях.
// ============================================================================
import { useState } from 'react'
import { Button } from './Button'
import { IconCheck, IconPlus, IconClose } from './icons'
import { TappableText, WordSheet, type WordPick } from './WordSheet'
import { addMarkedWords, addPhrase, type MarkedWord } from '../lib/batchWords'
import type { AppLang } from '../types'

export function MarkableText({
  text,
  lang,
  className,
}: {
  text: string
  lang: AppLang
  /** Классы абзаца (размер текста читалки). */
  className?: string
}) {
  const [pick, setPick] = useState<WordPick | null>(null)
  const [markMode, setMarkMode] = useState(false)
  const [marked, setMarked] = useState<Map<number, MarkedWord>>(new Map())
  const [busy, setBusy] = useState(false)
  const [busyPhrase, setBusyPhrase] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const exitMark = () => {
    setMarkMode(false)
    setMarked(new Map())
  }

  // отмеченные слова В ТЕКСТОВОМ ПОРЯДКЕ (ключ Map — индекс токена), а не в
  // порядке нажатий — иначе фраза «look up» из тапов up→look собралась бы задом
  const orderedMarked = () => [...marked.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])

  const addAll = async () => {
    setBusy(true)
    setNote(null)
    try {
      const added = await addMarkedWords(orderedMarked(), lang)
      setNote(added > 0 ? `Добавлено слов: ${added} ✓` : 'Эти слова уже в колоде')
      exitMark()
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не удалось добавить')
    } finally {
      setBusy(false)
    }
  }

  // добавить отмеченные слова ОДНОЙ фразой (фразовые глаголы, выражения)
  const addAsPhrase = async () => {
    setBusyPhrase(true)
    setNote(null)
    try {
      const ok = await addPhrase(orderedMarked(), lang)
      setNote(ok ? 'Фраза добавлена ✓' : 'Эта фраза уже в колоде')
      exitMark()
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не удалось добавить')
    } finally {
      setBusyPhrase(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => (markMode ? exitMark() : setMarkMode(true))}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-sm ${
            markMode
              ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)] text-[var(--night-accent-100)]'
              : 'border-white/[0.10] text-[var(--night-text-40)]'
          }`}
        >
          <IconPlus size={14} />
          {markMode ? 'Отмена' : 'Отметить слова'}
        </button>
        {note && <span className="text-sm text-emerald-400">{note}</span>}
      </div>
      {markMode && (
        <p className="text-xs text-[var(--night-text-40)]">
          Тапай по словам. Несколько слов можно добавить «Фразой» — одной карточкой
          (для фразовых глаголов: look up, give up).
        </p>
      )}

      <p className={className}>
        <TappableText
          text={text}
          onSelect={setPick}
          markMode={markMode}
          marked={new Set(marked.keys())}
          onToggleMark={(i, word, sentence) =>
            setMarked((prev) => {
              const next = new Map(prev)
              if (next.has(i)) next.delete(i)
              else next.set(i, { word, sentence })
              return next
            })
          }
        />
      </p>

      {/* плавающая панель добавления — над нижней навигацией */}
      {markMode && marked.size > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-screen-sm items-center gap-2 rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(30,32,48,.97)] p-2.5 backdrop-blur-xl">
          {marked.size >= 2 && (
            <Button
              className="flex-1 py-2.5 text-sm"
              loading={busyPhrase}
              disabled={busy}
              onClick={addAsPhrase}
            >
              <IconCheck size={16} /> Фразой
            </Button>
          )}
          <Button
            variant={marked.size >= 2 ? 'secondary' : 'primary'}
            className="flex-1 py-2.5 text-sm"
            loading={busy}
            disabled={busyPhrase}
            onClick={addAll}
          >
            <IconCheck size={16} /> {marked.size >= 2 ? `По слову (${marked.size})` : 'В колоду'}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-2.5 text-sm"
            disabled={busy || busyPhrase}
            onClick={exitMark}
            aria-label="Отмена"
          >
            <IconClose size={16} />
          </Button>
        </div>
      )}

      {pick && (
        <WordSheet word={pick.word} sentence={pick.sentence} lang={lang} onClose={() => setPick(null)} />
      )}
    </div>
  )
}
