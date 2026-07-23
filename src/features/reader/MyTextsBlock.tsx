// ============================================================================
// «Мои тексты» в читалке (EN и ES): свои тексты — вставкой или из файла
// (PDF/DOCX/TXT). Список над встроенными текстами; чтение — та же читалка с
// тап-словарём («В колоду» работает как в обычных текстах).
// Хранение и парсинг файлов — lib/myTexts (локально, лимит 15 000 знаков).
// ============================================================================
import { useRef, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { BackHeader } from '../../components/BackButton'
import { MarkableText } from '../../components/MarkableText'
import { IconPlus, IconTrash } from '../../components/icons'
import { getSettings, READER_CLASSES } from '../../lib/settings'
import {
  addMyText,
  extractFileText,
  listMyTexts,
  removeMyText,
  MY_TEXT_LIMIT,
  type MyText,
} from '../../lib/myTexts'
import type { AppLang } from '../../types'

/** Список своих текстов + кнопка добавления (рендерится в шапке читалки). */
export function MyTextsList({
  lang,
  onAdd,
  onOpen,
}: {
  lang: AppLang
  onAdd: () => void
  onOpen: (t: MyText) => void
}) {
  const [texts, setTexts] = useState<MyText[]>(() => listMyTexts(lang))
  const refresh = () => setTexts(listMyTexts(lang))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--night-text-40)]">
          Мои тексты
        </p>
        <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={onAdd}>
          <IconPlus size={15} /> Свой текст
        </Button>
      </div>
      {texts.length > 0 && (
        <div className="flex flex-col gap-2">
          {texts.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                <Card className="px-4 py-3 transition-transform active:scale-[0.99]">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--night-text-40)]">
                    {t.body}
                  </p>
                </Card>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Удалить «${t.title}»?`)) {
                    removeMyText(lang, t.id)
                    refresh()
                  }
                }}
                aria-label={`Удалить ${t.title}`}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-white/[0.08] text-[var(--night-text-40)]"
              >
                <IconTrash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AddTextForm({
  lang,
  onDone,
}: {
  lang: AppLang
  onDone: (opened: MyText | null) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      const text = await extractFileText(file)
      setBody(text)
      if (!title) setTitle(file.name.replace(/\.(pdf|docx|txt)$/i, ''))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!body.trim()) {
      setErr('Вставь текст или выбери файл')
      return
    }
    const t = addMyText(lang, title, body)
    onDone(t)
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={() => onDone(null)} title="Свой текст" />
      <p className="text-sm text-[var(--night-text-40)]">
        Вставь текст или выбери файл (.pdf, .docx, .txt) — он откроется в
        читалке с переводом слов по тапу. Лимит {MY_TEXT_LIMIT.toLocaleString('ru-RU')}{' '}
        знаков; текст хранится только на этом устройстве.
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название (необязательно)"
        aria-label="Название текста"
        className="rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-4 py-2.5 outline-none focus:border-[var(--night-accent-45)]"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder={lang === 'es' ? 'Pega el texto aquí…' : 'Paste your text here…'}
        aria-label="Текст"
        className="rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-4 py-2.5 text-[15px] leading-relaxed outline-none focus:border-[var(--night-accent-45)]"
      />
      {body.length > MY_TEXT_LIMIT && (
        <p className="text-xs text-amber-300">
          Текст длиннее лимита — сохранятся первые {MY_TEXT_LIMIT.toLocaleString('ru-RU')} знаков.
        </p>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex flex-wrap gap-2">
        <Button className="px-4 py-2 text-sm" loading={busy} onClick={save}>
          Сохранить и читать
        </Button>
        <Button
          variant="secondary"
          className="px-3 py-2 text-sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Читаю файл…' : 'Из файла (PDF / DOCX / TXT)'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,text/plain,application/pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

export function MyTextReader({
  text,
  lang,
  onBack,
}: {
  text: MyText
  lang: AppLang
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title={text.title} />
      {text.truncated && (
        <p className="text-xs text-amber-300">Текст был обрезан по лимиту при добавлении.</p>
      )}
      <Card>
        <MarkableText
          text={text.body}
          lang={lang}
          className={`whitespace-pre-wrap ${READER_CLASSES[getSettings().readerSize]}`}
        />
      </Card>
    </div>
  )
}
