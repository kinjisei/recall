// Шаг 1: форма заявки на материал (язык/уровень/тема/формат/длина/слова/
// грамматика) → AI составляет план.
import { useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import {
  MATERIAL_FORMATS,
  MATERIAL_LENGTHS,
  generateMaterialPlan,
  type MaterialRequest,
} from '../../../lib/materials'
import type { AppLang, CEFRLevel, MaterialPlan } from '../../../types'
import { LEVELS, inputClass } from './shared'

export function RequestForm({
  onCancel,
  onPlanned,
}: {
  onCancel: () => void
  onPlanned: (req: MaterialRequest, plan: MaterialPlan) => void
}) {
  const [lang, setLang] = useState<AppLang>('en')
  const [level, setLevel] = useState<CEFRLevel>('A2')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<string>(MATERIAL_FORMATS[0])
  const [lengthRange, setLengthRange] = useState<MaterialRequest['lengthRange']>('100-250')
  const [vocabulary, setVocabulary] = useState('')
  const [grammar, setGrammar] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    const req: MaterialRequest = {
      lang,
      level,
      topic: topic.trim(),
      format,
      lengthRange,
      vocabulary,
      grammar,
    }
    try {
      const plan = await generateMaterialPlan(req)
      onPlanned(req, plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации плана')
    } finally {
      setBusy(false)
    }
  }

  const chip = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${
      active
        ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
        : 'bg-white/[0.07] text-[var(--night-text-70)]'
    }`

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Новый материал</p>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Язык</p>
        <div className="flex gap-2">
          <button className={chip(lang === 'en')} onClick={() => setLang('en')}>Английский</button>
          <button className={chip(lang === 'es')} onClick={() => setLang('es')}>Испанский</button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Уровень ученика</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Тема текста *</p>
        <input
          className={inputClass}
          placeholder="Например: Путешествие в горы"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Формат</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_FORMATS.map((f) => (
            <button key={f} className={chip(format === f)} onClick={() => setFormat(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Длина (слов)</p>
        <div className="flex gap-2">
          {MATERIAL_LENGTHS.map((l) => (
            <button key={l} className={chip(lengthRange === l)} onClick={() => setLengthRange(l)}>{l}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">
          Слова через запятую или тема словаря (необязательно)
        </p>
        <input
          className={inputClass}
          placeholder="mountain, tent, campfire — или просто «поход»"
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">
          Грамматическая тема (необязательно)
        </p>
        <input
          className={inputClass}
          placeholder="there is / there are"
          value={grammar}
          onChange={(e) => setGrammar(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={busy || !topic.trim()}>
          {busy ? 'AI составляет план…' : 'Составить план →'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </Button>
      </div>
    </Card>
  )
}
