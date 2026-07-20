// ============================================================================
// AI-квесты — сторона преподавателя (раскрывающийся раздел в карточке ученицы
// на TeacherPage): назначить квест (язык, уровень, грамматическая тема,
// сценарий, порог верных ответов) и следить за прогрессом; переписку ученицы
// с AI можно раскрыть и проверить.
// ============================================================================
import { useCallback, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import { assignQuest, deleteQuest, listStudentQuests } from '../../lib/quests'
import type { AppLang, GrammarQuest } from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** Готовые сценарии — можно выбрать или вписать свой. */
const SCENARIOS = [
  'Побег из запертой комнаты',
  'Собеседование на работу мечты',
  'Детектив: пропажа в отеле',
  'Заказ в кафе в чужой стране',
  'Выживание на необитаемом острове',
  'Путешествие во времени',
]

/** Подсказки тем — свободное поле, это только datalist. */
const TOPIC_HINTS = [
  'Present Simple',
  'Past Simple',
  'Present Perfect',
  'Future (will / going to)',
  'Conditionals (if)',
  'Passive voice',
  'Modal verbs',
  'Pretérito Indefinido',
  'Subjuntivo',
  'Ser vs Estar',
]

const inputCls =
  'w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)]'

export function QuestSection({ studentId }: { studentId: string }) {
  const load = useCallback(() => listStudentQuests(studentId), [studentId])
  const { data: quests, error, loading, reload } = useAsyncData<GrammarQuest[]>(
    load,
    [studentId],
    'Не удалось загрузить квесты',
  )

  const [lang, setLang] = useState<AppLang>('en')
  const [level, setLevel] = useState<string>('B1')
  const [topic, setTopic] = useState('')
  const [scenario, setScenario] = useState(SCENARIOS[0])
  const [custom, setCustom] = useState('')
  const [target, setTarget] = useState(10)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openChat, setOpenChat] = useState<string | null>(null)

  const submit = async () => {
    const scen = (custom.trim() || scenario).trim()
    if (!topic.trim() || !scen) {
      setFormError('Укажи тему грамматики и сценарий.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await assignQuest({
        studentId,
        lang,
        level,
        topic: topic.trim(),
        scenario: scen,
        target,
      })
      setTopic('')
      setCustom('')
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось назначить квест')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Снять этот квест?')) return
    try {
      await deleteQuest(id)
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось удалить')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] p-3">
      {/* назначенные квесты */}
      {loading ? (
        <p className="text-sm text-[var(--night-text-40)]">Загрузка…</p>
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (quests ?? []).length === 0 ? (
        <p className="text-sm text-[var(--night-text-40)]">
          Квестов пока нет — назначь первый ниже.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {(quests ?? []).map((q) => (
            <div key={q.id} className="rounded-lg border border-white/[0.08] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{q.scenario}</p>
                  <p className="text-xs text-[var(--night-text-40)]">
                    {q.topic} · {q.lang.toUpperCase()} {q.level} ·{' '}
                    {q.status === 'completed' ? (
                      <span className="font-semibold text-emerald-400">
                        пройден ✓ {q.target}/{q.target}
                      </span>
                    ) : (
                      <>верных: {q.progress}/{q.target}</>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {(q.messages?.length ?? 0) > 0 && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setOpenChat((v) => (v === q.id ? null : q.id))}
                    >
                      {openChat === q.id ? 'Скрыть чат' : 'Чат'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => remove(q.id)}
                  >
                    Снять
                  </Button>
                </div>
              </div>
              {openChat === q.id && (
                <div className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-lg bg-black/20 p-2">
                  {(q.messages ?? [])
                    .filter((m) => m.content !== '/start')
                    .map((m, i) => (
                      <p
                        key={i}
                        className={`whitespace-pre-wrap text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'text-[var(--night-accent-text)]'
                            : 'text-[var(--night-text-70)]'
                        }`}
                      >
                        <b>{m.role === 'user' ? 'Ученица: ' : 'AI: '}</b>
                        {m.content.replace(/^\s*VERDICT:\s*\w+\s*/i, '')}
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* форма назначения */}
      <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
            Язык
            <select value={lang} onChange={(e) => setLang(e.target.value as AppLang)} className={inputCls}>
              <option value="en">Английский</option>
              <option value="es">Испанский</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
            Уровень
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls}>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
          Тема грамматики
          <input
            list="quest-topics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Past Simple, Conditionals…"
            className={inputCls}
          />
          <datalist id="quest-topics">
            {TOPIC_HINTS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
          Сценарий
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} className={inputCls}>
            {SCENARIOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
          Или свой сценарий (перекрывает выбор выше)
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Например: репортаж с футбольного матча"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--night-text-40)]">
          Верных ответов для зачёта: {target}
          <input
            type="range"
            min={3}
            max={30}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="accent-[var(--night-accent)]"
          />
        </label>
        {formError && <p className="text-sm text-red-400">{formError}</p>}
        <Button loading={busy} onClick={submit} className="py-2 text-sm">
          Назначить квест
        </Button>
      </div>
    </div>
  )
}
