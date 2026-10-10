// Шаг 1: форма заявки на материал (язык/уровень/тема/формат/длина/слова/
// грамматика) → AI составляет план.
import { useState } from 'react'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { useLanguage } from '../../../context/LanguageContext'
import {
  MATERIAL_FORMATS,
  MATERIAL_LENGTHS,
  generateMaterialPlan,
  generateExercisesForText,
  ownTextRequest,
  ownTextPlan,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import { MY_TEXT_LIMIT } from '../../../lib/myTexts'
import type { AppLang, CEFRLevel, MaterialPlan } from '../../../types'
import type { StudentInfo } from '../../../lib/teacher'
import { LEVELS, chip, inputClass } from './shared'
import { pickedIds } from './audience'
import { ForWhom } from './ForWhom'
import { FORM_HINTS } from '../formHints'
import { useDraftForm } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'

/** Черновик заявки — его стирает и MaterialsSection, когда материал сохранён. */
export const REQUEST_DRAFT = 'material-request'

export function RequestForm({
  students,
  resumeLabel,
  onResume,
  onCancel,
  onPlanned,
  onOwnGenerated,
}: {
  /** Для кого можно собрать материал: AI видит их диагностику, «Сохранить» назначает им. */
  students: StudentInfo[]
  /** Есть готовый план или упражнения впереди (вернулись «назад») — подпись кнопки к ним. */
  resumeLabel?: string
  onResume: () => void
  onCancel: () => void
  onPlanned: (req: MaterialRequest, plan: MaterialPlan) => void
  /** «Мой текст»: упражнения готовы, сразу в предпросмотр (плана нет). */
  onOwnGenerated: (req: MaterialRequest, plan: MaterialPlan, content: MaterialContent) => void
}) {
  // Заявка — черновик (Ф1.14): переживает перезагрузку и «назад» из плана;
  // стирается при отмене и когда материал сохранён (MaterialsSection).
  const [form, field, draft] = useDraftForm(REQUEST_DRAFT, {
    source: 'generate' as 'generate' | 'own',
    lang: useLanguage().lang as AppLang, // тот, что учитель преподаёт (шапка, онбординг Ф2.11)
    level: 'A2' as CEFRLevel,
    topic: '',
    format: MATERIAL_FORMATS[0] as string,
    lengthRange: '100-250' as MaterialRequest['lengthRange'],
    vocabulary: '',
    grammar: '',
    body: '',
    // Для кого (Ф2.11б-3): несколько учеников, им же назначится. Пусто — материал общий.
    studentIds: [] as string[],
  })
  const { source, lang, level, topic, format, lengthRange, vocabulary, grammar, body } = form
  const picked = pickedIds(form) // черновик до Ф2.11б-3 хранил одного ученика
  const [setSource, setLang, setLevel, setTopic] = [field('source'), field('lang'), field('level'), field('topic')]
  const [setFormat, setLengthRange, setVocabulary] = [field('format'), field('lengthRange'), field('vocabulary')]
  const [setGrammar, setBody, setStudentIds] = [field('grammar'), field('body'), field('studentIds')]
  const hints = FORM_HINTS[lang]
  const cancel = () => {
    // «Отмена» выбрасывает и готовое впереди — то, что уже стоило генерации AI
    if (resumeLabel && !window.confirm('Выбросить материал? То, что уже составил AI, пропадёт.')) return
    draft.clear()
    onCancel()
  }
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
      studentIds: picked,
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

  const submitOwn = async () => {
    const text = body.trim()
    if (text.length < 40 || busy) return
    setBusy(true)
    setError(null)
    try {
      const content = await generateExercisesForText(text, lang, level, { vocabulary, grammar })
      onOwnGenerated({ ...ownTextRequest(lang, level, text, { vocabulary, grammar }), studentIds: picked }, ownTextPlan(), content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации упражнений')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-semibold">Новый материал</p>
      {draft.restored && <DraftRestored onClear={draft.clear} />}
      {resumeLabel && (
        <Button variant="secondary" onClick={onResume}>
          {resumeLabel} →
        </Button>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-fg-muted">Источник текста</p>
        <div className="flex gap-2">
          <button className={chip(source === 'generate')} onClick={() => setSource('generate')}>
            Сгенерировать
          </button>
          <button className={chip(source === 'own')} onClick={() => setSource('own')}>
            Мой текст
          </button>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-fg-muted">Язык</p>
        <div className="flex gap-2">
          <button className={chip(lang === 'en')} onClick={() => setLang('en')}>Английский</button>
          <button className={chip(lang === 'es')} onClick={() => setLang('es')}>Испанский</button>
        </div>
      </div>

      {/* Для кого — до уровня: выбор учеников ставит уровень самого слабого. */}
      {students.length > 0 && (
        <ForWhom
          students={students}
          lang={lang}
          level={level}
          own={source === 'own'}
          picked={picked}
          onPick={(ids, weakest) => {
            setStudentIds(ids)
            if (weakest) setLevel(weakest)
          }}
        />
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-fg-muted">Уровень ученика</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} className={chip(level === l)} onClick={() => setLevel(l)}>{l}</button>
          ))}
        </div>
      </div>

      {source === 'generate' ? (
        <>
          <div>
            <p className="mb-1 text-xs font-semibold text-fg-muted">Тема текста *</p>
            <input
              className={inputClass}
              placeholder="Например: Путешествие в горы"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-fg-muted">Формат</p>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_FORMATS.map((f) => (
                <button key={f} className={chip(format === f)} onClick={() => setFormat(f)}>{f}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-fg-muted">Длина (слов)</p>
            <div className="flex gap-2">
              {MATERIAL_LENGTHS.map((l) => (
                <button key={l} className={chip(lengthRange === l)} onClick={() => setLengthRange(l)}>{l}</button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div>
          <p className="mb-1 text-xs font-semibold text-fg-muted">
            Твой текст (упражнения соберутся строго по нему)
          </p>
          <textarea
            className={`${inputClass} min-h-[160px]`}
            placeholder="Вставь сюда текст на выбранном языке…"
            value={body}
            maxLength={MY_TEXT_LIMIT}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-fg-muted">
            {body.trim().length} / {MY_TEXT_LIMIT}
          </p>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-fg-muted">
          {source === 'own'
            ? 'Слова для акцента в словаре (необязательно)'
            : 'Слова, тема словаря или просто тема (необязательно)'}
        </p>
        <input
          className={inputClass}
          placeholder={source === 'own' ? hints.words : `${hints.words} — или просто «природа»`}
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-fg-muted">
          {source === 'own' ? 'Акцент на грамматике (необязательно)' : 'Грамматическая тема (необязательно)'}
        </p>
        <input
          className={inputClass}
          placeholder={hints.grammar}
          value={grammar}
          onChange={(e) => setGrammar(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {source === 'generate' ? (
          <Button className="flex-1" onClick={submit} disabled={busy || !topic.trim()}>
            {submitLabel(false, busy, !!resumeLabel)}
          </Button>
        ) : (
          <Button className="flex-1" onClick={submitOwn} disabled={busy || body.trim().length < 40}>
            {submitLabel(true, busy, !!resumeLabel)}
          </Button>
        )}
        <Button variant="ghost" onClick={cancel} disabled={busy}>
          Отмена
        </Button>
      </div>
    </Card>
  )
}

/** Подпись главной кнопки; готовое впереди уже есть (again) — новое его заменит. */
function submitLabel(own: boolean, busy: boolean, again: boolean): string {
  if (busy) return own ? 'AI собирает упражнения…' : 'AI составляет план…'
  if (own) return again ? 'Составить заново →' : 'Составить упражнения →'
  return again ? 'Новый план →' : 'Составить план →'
}
