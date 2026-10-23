// ============================================================================
// Шаг 1 мастера: заявка на материал (макет d8-2, PLAN.md Ф2.17-4в-2б). Слева
// три карточки — источник и язык; для кого и уровень; тема, формат, длина,
// слова и грамматика (или свой текст). Справа «Итог»: для кого, уровень, что
// получится, сколько генераций уйдёт, «Новый план →» и «Отмена». Заявка —
// черновик (Ф1.14): переживает перезагрузку и «назад» из плана.
// ============================================================================
import { useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { fieldClass } from '../../../shared/ui/TextField'
import { MainAside } from '../../../shared/ui/layouts'
import { useLanguage } from '../../../context/LanguageContext'
import {
  MATERIAL_FORMATS,
  generateMaterialPlan,
  generateExercisesForText,
  ownTextRequest,
  ownTextPlan,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import { LENGTH_LABEL, MATERIAL_LENGTHS } from '../../../lib/materialLengths'
import { MY_TEXT_LIMIT } from '../../../lib/myTexts'
import type { AppLang, CEFRLevel, MaterialPlan } from '../../../types'
import type { StudentInfo } from '../../../lib/teacher'
import { LEVELS } from './shared'
import { levelSummary, pickedIds } from './audience'
import { ForWhom } from './ForWhom'
import { FORM_HINTS } from '../formHints'
import { useDraftForm } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { FieldLabel, FormCard, Hint, LANG_NAME, Summary, WizardTop, audienceItems, gensAfter, materialLine } from './wizardBits'
import type { StudentLevels } from './useStudentLevels'
import { WordChips, splitWords } from './WordChips'
import { ErrorText } from '../../../shared/ui/ErrorText'

/** Черновик заявки — его стирает и MaterialsSection, когда материал сохранён. */
export const REQUEST_DRAFT = 'material-request'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function RequestForm({
  students,
  levels,
  gens,
  resumeLabel,
  onResume,
  onCancel,
  onPlanned,
  onOwnGenerated,
}: {
  /** Для кого можно собрать материал: AI видит их диагностику, «Сохранить» назначает им. */
  students: StudentInfo[]
  levels: StudentLevels
  /** Остаток генераций в месяце — «Уйдёт 1 генерация · останется 24 из 25». */
  gens: { left: number; limit: number } | null
  /** Есть готовый план или упражнения впереди (вернулись «назад») — подпись кнопки к ним. */
  resumeLabel?: string
  onResume: () => void
  onCancel: () => void
  onPlanned: (req: MaterialRequest, plan: MaterialPlan, replan?: { id: string; left: number }) => void
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
    format: 'рассказ' as string,
    lengthRange: '100-140' as MaterialRequest['lengthRange'],
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
  const own = source === 'own'
  const hints = FORM_HINTS[lang]
  const { confirm, dialog } = useConfirm()
  const cancel = async () => {
    // «Отмена» выбрасывает и готовое впереди — то, что уже стоило генерации AI
    if (resumeLabel && !(await confirm({ title: 'Выбросить материал?', body: 'То, что уже составил AI, пропадёт.', action: 'Выбросить', cancel: 'Оставить' }))) return
    draft.clear()
    onCancel()
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    const req: MaterialRequest = { lang, level, topic: topic.trim(), format, lengthRange, vocabulary, grammar, studentIds: picked }
    try {
      let grant: { id: string; left: number } | undefined
      const plan = await generateMaterialPlan(req, undefined, { onReplan: (g) => (grant = g) })
      onPlanned(req, plan, grant)
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

  const names = picked.map(levels.nameOf)
  const ready = own ? body.trim().length >= 40 : !!topic.trim()
  const levelOptions = LEVELS.filter((l) => l !== 'C2' || level === 'C2')
  const words = splitWords(vocabulary)
  const aside = (
    <Summary
      items={[
        ...audienceItems(names, level, levels.known(lang) ? levelSummary(levels.picked(picked, lang), level) : undefined),
        own
          ? { label: 'Что получится', value: `Свой текст, ${LANG_NAME[lang]}`, note: 'упражнения соберёт AI строго по тексту' }
          : {
              label: 'Что получится',
              value: materialLine(format, lengthRange, lang),
              note: [topic.trim() && `«${topic.trim()}»`, grammar.trim(), 'упражнения предложит AI в плане'].filter(Boolean).join(' · '),
            },
      ]}
      gen={
        <>
          Уйдёт <b className="font-semibold text-fg">1 генерация</b>
          {gens && (
            <>
              <br />
              {gensAfter(gens, 1)}
            </>
          )}
        </>
      }
    >
      {error && <ErrorText>{error}</ErrorText>}
      <Button className="w-full" onClick={own ? submitOwn : submit} loading={busy} disabled={!ready}>
        {own ? 'Составить упражнения →' : 'Новый план →'}
      </Button>
      {resumeLabel && (
        <Button variant="secondary" className="w-full" onClick={onResume} disabled={busy}>
          {resumeLabel} →
        </Button>
      )}
      <Button variant="outline" className="w-full" onClick={() => void cancel()} disabled={busy}>
        Отмена
      </Button>
    </Summary>
  )

  const main = (
    <div className="flex flex-col gap-3.5">
      {draft.restored && <DraftRestored onClear={draft.clear} />}
      <FormCard label="Источник и язык">
        <div>
          <FieldLabel>Источник текста</FieldLabel>
          <ChoiceGroup variant="segment" label="Источник текста" value={source} onChange={setSource} options={[{ id: 'generate', label: 'Сгенерировать' }, { id: 'own', label: 'Мой текст' }]} />
        </div>
        <div>
          <FieldLabel>Язык</FieldLabel>
          <ChoiceGroup variant="segment" label="Язык" value={lang} onChange={setLang} options={[{ id: 'en', label: 'Английский' }, { id: 'es', label: 'Испанский' }]} />
        </div>
      </FormCard>
      <FormCard label="Для кого и уровень">
        {/* Для кого — до уровня: выбор учеников ставит уровень самого слабого. */}
        {students.length > 0 && (
          <ForWhom
            students={students}
            lang={lang}
            level={level}
            own={own}
            picked={picked}
            levels={levels}
            onPick={(ids, weakest) => {
              setStudentIds(ids)
              if (weakest) setLevel(weakest)
            }}
          />
        )}
        <div>
          <FieldLabel>Уровень</FieldLabel>
          <ChoiceGroup variant="segment" label="Уровень" value={level} onChange={setLevel} options={levelOptions.map((l) => ({ id: l, label: l }))} />
        </div>
      </FormCard>
      <FormCard label={own ? 'Свой текст' : 'О чём текст'}>
        {own ? (
          <label className="block">
            <FieldLabel aside={<span className="font-normal tabular-nums">{body.trim().length} / {MY_TEXT_LIMIT}</span>}>Твой текст — упражнения соберутся строго по нему</FieldLabel>
            <textarea lang={lang} className={`${fieldClass()} field-sizing-content min-h-40! py-3`} placeholder="Вставь сюда текст на выбранном языке…" value={body} maxLength={MY_TEXT_LIMIT} onChange={(e) => setBody(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="block">
              <FieldLabel>Тема</FieldLabel>
              <input className={fieldClass()} placeholder="Например: Путешествие в горы" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </label>
            <div>
              <FieldLabel>Формат</FieldLabel>
              <ChoiceGroup label="Формат" value={format} onChange={setFormat} options={MATERIAL_FORMATS.map((f) => ({ id: f, label: cap(f) }))} />
            </div>
            <div>
              <FieldLabel>Длина</FieldLabel>
              <ChoiceGroup variant="segment" label="Длина" value={lengthRange} onChange={setLengthRange} options={MATERIAL_LENGTHS.map((l) => ({ id: l, label: LENGTH_LABEL[l] }))} />
            </div>
          </>
        )}
        <div>
          <FieldLabel opt={own}>{own ? 'Слова для акцента в словаре' : 'Слова, тема словаря или просто тема'}</FieldLabel>
          <WordChips lang={lang} words={words} onChange={(w) => setVocabulary(w.join(', '))} placeholder={own ? 'слово' : 'слово или тема'} inputLabel={own ? 'Слово для акцента' : 'Слово или тема'} />
          {!own && <Hint>Можно и просто тему: «природа». Enter — добавить. Например: {hints.words}</Hint>}
        </div>
        <label className="block">
          <FieldLabel opt>{own ? 'Акцент на грамматике' : 'Грамматика'}</FieldLabel>
          <input lang={lang} className={fieldClass()} placeholder={hints.grammar} value={grammar} onChange={(e) => setGrammar(e.target.value)} />
        </label>
      </FormCard>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <WizardTop current="form" own={own} go={{ plan: resumeLabel && !own ? onResume : null, text: resumeLabel && own ? onResume : null }} onExit={() => void cancel()} />
      <MainAside size="work" label="Итог" main={main} aside={aside} />
      {dialog}
    </div>
  )
}
