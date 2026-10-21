// ============================================================================
// AI-квесты — сторона преподавателя (раздел карточки ученика, макет d10-4,
// Ф2.17-4б-2): назначенные квесты с прогрессом и перепиской ученика с AI, ниже
// — «Новый квест»: язык и уровень полосами, тема грамматики, сценарий
// плитками в две колонки (или свой), «Верных ответов для зачёта» ползунком;
// внизу панели — «Квест придёт Айгерим в приложение» и «Назначить квест».
// Пусто — «Квестов пока нет — назначь первый ниже».
// ============================================================================
import { useCallback, useState } from 'react'
import { firstName } from '../../domains/students'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { RevealLink } from '../../shared/ui/Disclosure'
import { useLanguage } from '../../context/LanguageContext'
import { Reveal } from '../../shared/ui/Reveal'
import { LoadError } from '../../shared/ui/LoadError'
import { Slider } from '../../shared/ui/Slider'
import { Field, TextField } from '../../shared/ui/TextField'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { assignQuest, deleteQuest, listStudentQuests } from '../../lib/quests'
import type { AppLang, GrammarQuest } from '../../types'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { FORM_HINTS, questTopicHint } from './formHints'
import { InfoBox, Pill, SectionCard, SectionFooter } from './sectionBits'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
const LANGS: { id: AppLang; label: string }[] = [
  { id: 'en', label: 'Английский' },
  { id: 'es', label: 'Испанский' },
]

/**
 * Готовые сценарии (d10-4) — бытовые ситуации, которые ученик узнаёт сразу;
 * остальное — «Свой сценарий». Плиток четыре, чтобы форма с ползунком
 * помещалась над подвалом на 1280 × 800.
 */
const SCENARIOS = ['В аэропорту', 'В отеле', 'Собеседование']
/** Плитка «Свой сценарий» — открывает поле. */
const CUSTOM = 'custom'

export function QuestSection({ studentId, studentName }: { studentId: string; studentName: string }) {
  const load = useCallback(() => listStudentQuests(studentId), [studentId])
  const { data: quests, error, loading, reload } = useAsyncData<GrammarQuest[]>(load, [studentId], 'Не удалось загрузить квесты')
  const { confirm, dialog } = useConfirm()

  // язык по умолчанию — тот, что учитель преподаёт (EN/ES в шапке, онбординг Ф2.11)
  const [lang, setLang] = useState<AppLang>(useLanguage().lang)
  const [level, setLevel] = useState<string>('B1')
  const [topic, setTopic] = useState('')
  // SCENARIOS — непустой константный список, [0] всегда есть; ?? '' только
  // для noUncheckedIndexedAccess (на практике не сработает)
  const [scenario, setScenario] = useState<string>(SCENARIOS[0] ?? '')
  const [custom, setCustom] = useState('')
  const [target, setTarget] = useState(10)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openChat, setOpenChat] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const submit = async () => {
    const scen = (scenario === CUSTOM ? custom : scenario).trim()
    if (!topic.trim() || !scen) {
      setFormError(scenario === CUSTOM && !scen ? 'Впиши свой сценарий.' : 'Укажи тему грамматики.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await assignQuest({ studentId, lang, level, topic: topic.trim(), scenario: scen, target })
      setTopic('')
      setCustom('')
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось назначить квест')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (q: GrammarQuest) => {
    if (removingId) return
    const ok = await confirm({
      title: 'Снять квест?',
      body: `«${q.scenario}» пропадёт у ученика вместе с перепиской.`,
      action: 'Снять',
    })
    if (!ok) return
    setRemovingId(q.id)
    try {
      await deleteQuest(q.id)
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось удалить')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      {loading ? (
        <RowsSkeleton count={2} height={56} />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !quests?.length ? (
        <InfoBox raised>Квестов пока нет — назначь первый ниже</InfoBox>
      ) : (
        <SectionCard title="Квесты" note={`${quests.length}`}>
          <div className="flex flex-col divide-y divide-line">
            {quests.map((q) => (
              <QuestRow
                key={q.id}
                q={q}
                open={openChat === q.id}
                onChat={() => setOpenChat((v) => (v === q.id ? null : q.id))}
                onRemove={() => void remove(q)}
                removing={removingId === q.id}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Новый квест">
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          <Field label="Язык">
            <ChoiceGroup variant="segment" label="Язык" options={LANGS} value={lang} onChange={setLang} />
          </Field>
          <Field label="Уровень">
            <ChoiceGroup variant="segment" label="Уровень" options={LEVELS.map((l) => ({ id: l, label: l }))} value={level} onChange={setLevel} />
          </Field>
        </div>
        <TextField label="Тема грамматики" list="quest-topics" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={questTopicHint(lang)} />
        <datalist id="quest-topics">
          {FORM_HINTS[lang].questTopics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Field label="Сценарий">
          <ChoiceGroup
            variant="tiles"
            label="Сценарий"
            options={[...SCENARIOS.map((s) => ({ id: s, label: s })), { id: CUSTOM, label: 'Свой сценарий' }]}
            value={scenario}
            onChange={setScenario}
          />
          {scenario === CUSTOM && (
            <TextField
              label="Свой сценарий"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Например: репортаж с футбольного матча"
              className="mt-2"
              autoFocus
            />
          )}
        </Field>
        <Field
          label={
            <>
              Верных ответов для зачёта: <b className="font-semibold tabular-nums text-fg">{target}</b>
            </>
          }
        >
          <Slider value={target} min={3} max={30} onChange={setTarget} label="Верных ответов для зачёта" />
        </Field>
        {formError && <p className="text-sm text-danger-strong">{formError}</p>}
      </SectionCard>

      <SectionFooter text={`Квест придёт ${firstName(studentName)} в приложение`}>
        <Button loading={busy} onClick={() => void submit()}>
          Назначить квест
        </Button>
      </SectionFooter>
      {dialog}
    </>
  )
}

/** Подпись над выбором (как у TextField) и сам выбор. */
/** Назначенный квест: сценарий, тема и уровень, счёт; переписку можно раскрыть. */
function QuestRow({ q, open, onChat, onRemove, removing }: { q: GrammarQuest; open: boolean; onChat: () => void; onRemove: () => void; removing: boolean }) {
  const chat = (q.messages ?? []).filter((m) => m.content !== '/start')
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex min-h-11 items-center gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="truncate text-body font-semibold text-fg">{q.scenario}</span>
          <small className="truncate text-note text-fg-muted">
            {q.topic} · {q.lang.toUpperCase()} {q.level}
          </small>
        </span>
        {q.status === 'completed' ? (
          <Pill tone="ok">
            Пройден · {q.target} из {q.target}
          </Pill>
        ) : (
          <Pill tone="plain">
            верных {q.progress} из {q.target}
          </Pill>
        )}
      </div>
      <div className="flex items-center gap-2">
        {chat.length > 0 && (
          <RevealLink open={open} onToggle={onChat}>
            {open ? 'Скрыть переписку' : 'Переписка'}
          </RevealLink>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onRemove} loading={removing}>
          Снять
        </Button>
      </div>
      <Reveal open={open}>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-control-sm bg-input p-3">
          {chat.map((m, i) => (
            <p key={i} className={`whitespace-pre-wrap text-note leading-relaxed ${m.role === 'user' ? 'text-accent-strong' : 'text-fg-secondary'}`}>
              <b>{m.role === 'user' ? 'Ученик: ' : 'AI: '}</b>
              {m.content.replace(/^\s*VERDICT:\s*\w+\s*/i, '')}
            </p>
          ))}
        </div>
      </Reveal>
    </div>
  )
}
