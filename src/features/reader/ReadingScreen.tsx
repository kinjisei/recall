// ============================================================================
// Экран чтения по макету d6 (Ф2.17-4д-4в) — один на английские тексты,
// испанские и «Мои тексты». Сверху: «‹ Учёба · Чтение · B1 · ~4 мин» и
// «Слушать текст». Колонкой: заголовок, «5 абзацев · 3 слова уже в твоих
// словах», текст — нажатие на слово открывает перевод; слова, которые уже в
// «Моих словах», подчёркнуты пунктиром, выбранное — в рамке.
// Компьютер (содержимое от 912, ReadingColumn): перевод в панели 320 справа,
// текст не сдвигается; пока слово не выбрано — подсказка и «Сохранено из
// этого текста». Телефон: перевод — шторкой снизу (WordSheet).
// ============================================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnalysisSheet } from '../../components/AnalysisSheet'
import { ReadingTools } from '../../components/MarkableText'
import { PhraseSheet, type PhrasePick } from '../../components/PhraseSheet'
import { TextAnalysisSheet } from '../../components/TextAnalysisSheet'
import { WordPanel } from '../../components/WordDetails'
import { cleanWord, TappableText, WordSheet, type WordPick } from '../../components/WordSheet'
import { listMyWords } from '../../lib/cards'
import { getSettings, READER_CLASSES } from '../../lib/settings'
import { speak, stopSpeaking } from '../../lib/speech'
import { useContentAtLeast } from '../../shared/lib/screenWidth'
import { plural } from '../../shared/lib/plural'
import { BackLink } from '../../shared/ui/BackButton'
import { AREA } from '../../shared/ui/breakpoints'
import { Button } from '../../shared/ui/Button'
import { IconPlay, IconStop, IconTranslate } from '../../shared/ui/icons'
import { ReadingColumn } from '../../shared/ui/layouts'
import { Reveal } from '../../shared/ui/Reveal'
import type { AppLang } from '../../types'

export interface ReadingParagraph {
  text: string
  /** Перевод абзаца по кнопке (испанские тексты). */
  ru?: string
}

/** Текст абзацами: пустая строка — граница абзаца. */
export function toParagraphs(body: string): ReadingParagraph[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ text }))
}

const wordsOf = (text: string) => text.split(/[\s—–…]+/).map((t) => cleanWord(t).toLowerCase()).filter(Boolean)

export function ReadingScreen({
  title,
  subtitle,
  backLabel,
  onBack,
  level,
  lang,
  paragraphs,
  tools = false,
  note,
  footer,
}: {
  title: string
  /** Строка под заголовком (перевод названия у испанских текстов). */
  subtitle?: string
  backLabel: string
  onBack: () => void
  level?: string
  lang: AppLang
  paragraphs: ReadingParagraph[]
  /** «Выделить фразу» и «Разобрать весь текст» (английские и свои тексты). */
  tools?: boolean
  /** Замечание над текстом («обрезан по лимиту»). */
  note?: ReactNode
  /** Под текстом (ведомое занятие: «Дальше»). */
  footer?: ReactNode
}) {
  const split = useContentAtLeast(AREA.readingSplit)
  const [pick, setPick] = useState<(WordPick & { para: number }) | null>(null)
  const [phrase, setPhrase] = useState<PhrasePick | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [analyzeAll, setAnalyzeAll] = useState(false)
  const [analyzeSentence, setAnalyzeSentence] = useState<string | null>(null)
  const [openRu, setOpenRu] = useState<Set<number>>(new Set())
  const [speaking, setSpeaking] = useState(false)
  // «Мои слова» этого языка: слово → перевод. Не загрузились — без пунктира и
  // без «Сохранено», а не «0 слов» (сбой — не пустота, Ф1.13)
  const [mine, setMine] = useState<Map<string, string> | null>(null)

  useEffect(() => {
    let alive = true
    listMyWords(lang)
      .then((ws) => alive && setMine(new Map(ws.map((w) => [w.card.front.toLowerCase(), w.card.back ?? '']))))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [lang])
  useEffect(() => () => stopSpeaking(), [])

  const full = useMemo(() => paragraphs.map((p) => p.text).join('\n\n'), [paragraphs])
  const inText = useMemo(() => new Set(wordsOf(full)), [full])
  const saved = mine ? [...mine.entries()].filter(([w]) => inText.has(w)) : null
  const marked = useMemo(() => (mine ? new Set([...mine.keys()].filter((w) => inText.has(w))) : undefined), [mine, inText])
  const minutes = Math.max(1, Math.round(inText.size === 0 ? 1 : wordsOf(full).length / 150))

  const meta = `Чтение${level ? ` · ${level}` : ''} · ~${minutes} мин`

  const listen = () => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    speak(full, { lang, onEnd: () => setSpeaking(false) })
  }
  const added = (front: string, back: string) => setMine((m) => new Map(m ?? []).set(front.toLowerCase(), back))

  const top = (
    <div className="mb-3 flex min-h-11 items-center gap-2">
      <BackLink label={backLabel} onClick={onBack} />
      {/* «Чтение · B1 · ~4 мин» — вверху на компьютере (d6); на телефоне — под заголовком, здесь тесно */}
      <span className="min-w-0 flex-1 truncate text-note text-fg-muted">{split && meta}</span>
      <Button size="sm" variant="secondary" className="flex-none px-3.5!" onClick={listen}>
        {speaking ? <IconStop size={16} aria-hidden /> : <IconPlay size={16} aria-hidden />}
        {speaking ? 'Стоп' : 'Слушать текст'}
      </Button>
    </div>
  )

  const aside =
    split && pick ? (
      <WordPanel
        key={`${pick.para}-${pick.at}-${pick.word}`}
        word={pick.word}
        sentence={pick.sentence}
        lang={lang}
        onClose={() => setPick(null)}
        onAdded={added}
        onAnalyze={() => setAnalyzeSentence(pick.sentence)}
      />
    ) : null

  return (
    <ReadingColumn
      top={top}
      aside={aside}
      onAsideClose={() => setPick(null)}
      asideLabel="Перевод"
      asideHint={<ReadingHint saved={saved} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-fg @lg:text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-fg-secondary">{subtitle}</p>}
          <p className="text-note text-fg-muted">
            {!split && `${meta} · `}
            {paragraphs.length} {plural(paragraphs.length, 'абзац', 'абзаца', 'абзацев')}
            {saved && saved.length > 0 && ` · ${saved.length} ${plural(saved.length, 'слово', 'слова', 'слов')} уже в твоих словах`}
          </p>
        </div>
        {note}

        {tools && <ReadingTools selectMode={selectMode} onToggleSelect={() => setSelectMode((v) => !v)} onAnalyzeAll={() => setAnalyzeAll(true)} />}

        <div className="flex flex-col gap-4">
          {paragraphs.map((p, i) => (
            <div key={i}>
              <p className={`whitespace-pre-wrap text-fg ${READER_CLASSES[getSettings().readerSize]}`}>
                <TappableText
                  text={p.text}
                  marked={marked}
                  activeAt={pick?.para === i ? (pick.at ?? null) : null}
                  selectMode={selectMode}
                  onSelect={(w) => setPick({ ...w, para: i })}
                  onPhrase={(text, sentence) => {
                    setPhrase({ text, sentence })
                    setSelectMode(false)
                  }}
                />
              </p>
              {p.ru && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenRu((prev) => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        return next
                      })
                    }
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-note font-semibold text-accent-strong"
                  >
                    <IconTranslate size={14} aria-hidden />
                    {openRu.has(i) ? 'Скрыть перевод' : 'Перевод'}
                  </button>
                  <Reveal open={openRu.has(i)}>
                    <p className="mt-1 rounded-tile bg-input px-3 py-2 text-sm text-fg-secondary">{p.ru}</p>
                  </Reveal>
                </>
              )}
            </div>
          ))}
        </div>
        {footer}
      </div>

      {!split && pick && (
        <WordSheet word={pick.word} sentence={pick.sentence} lang={lang} onClose={() => setPick(null)} onAdded={added} />
      )}
      {phrase && <PhraseSheet text={phrase.text} sentence={phrase.sentence} lang={lang} onClose={() => setPhrase(null)} />}
      {analyzeAll && <TextAnalysisSheet text={full} lang={lang} onClose={() => setAnalyzeAll(false)} />}
      {analyzeSentence && (
        <AnalysisSheet text={analyzeSentence} sentence={analyzeSentence} lang={lang} onClose={() => setAnalyzeSentence(null)} />
      )}
    </ReadingColumn>
  )
}

/** Панель, пока слово не выбрано (d6-1): подсказка и «Сохранено из этого текста». */
function ReadingHint({ saved }: { saved: [string, string][] | null }) {
  return (
    <div className="flex flex-col gap-3 text-fg">
      <p className="text-caption font-semibold text-fg-muted">Перевод</p>
      <p className="rounded-control bg-accent-soft px-3.5 py-3 text-note text-accent-soft-fg">
        Нажми на любое слово в тексте — перевод появится здесь.
      </p>
      {saved && saved.length > 0 && (
        <div className="flex flex-col">
          <p className="text-caption font-semibold text-fg-muted">Сохранено из этого текста · {saved.length}</p>
          <ul className="mt-1 divide-y divide-line">
            {saved.slice(0, 12).map(([w, t]) => (
              <li key={w} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm font-semibold">{w}</span>
                <span className="min-w-0 truncate text-note text-fg-muted">{t.split(' · ')[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
