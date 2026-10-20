// ============================================================================
// «Диагностика» — раздел карточки ученика у преподавателя (Ф2.11б-2; макет
// d10-2, Ф2.17-4б-2): сильные и слабые места из реальных данных, по
// карточкам: «Динамика за месяц» (было → стало, «лучше / хуже»), три числа
// (дней с занятиями из 14, слов в колоде, средний балл работ), «Слова»
// (новые · учатся · выучено, буксующие), «Задания» (письма и материалы со
// статусом, домашка на неделю), «Грамматика — слабые темы», последнее
// занятие из расписания. Данные — lib/diagnostics.ts, только чтение; отчёт
// родителям — вкладкой «Отчёт» в шапке раздела.
// ============================================================================
import type { ReactNode } from 'react'
import { dayShort, lessonDay, timeRange, whenDone, type Lesson } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import { getStudentDiagnostics, type StudentDiagnostics } from '../../lib/diagnostics'
import type { MetricDelta } from '../../lib/dynamics'
import { dueShort, getHomework, homeworkProgress } from '../../lib/homework'
import { listSubmittedWriting } from '../../lib/reviewQueue'
import { writingName } from '../../lib/writingLabels'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { IconArrowUp, IconClock } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { InfoBox, Pill, SectionCard } from './sectionBits'
import { useTopicTitles } from './topicTitles'
import type { AppLang } from '../../types'

const LANG_FLAG: Record<AppLang, string> = { en: 'EN', es: 'ES' }

/**
 * «Дни с занятиями  6 → 9  ↑ лучше»: было тихо, стало крупнее, итог словом и
 * стрелкой — направление читается и без цвета (dataviz). moreIsBetter=false —
 * для ошибок.
 */
function TrendRow({ label, d, unit = '', moreIsBetter = true }: { label: string; d: MetricDelta; unit?: string; moreIsBetter?: boolean }) {
  const diff = d.prev !== null && d.now !== null ? d.now - d.prev : null
  const better = diff !== null && diff !== 0 && diff > 0 === moreIsBetter
  return (
    <div className="flex min-h-10 items-center gap-2.5 text-body tabular-nums">
      <span className="min-w-0 flex-1 text-fg-secondary">{label}</span>
      <span className="text-fg-muted">{d.prev === null ? '—' : `${d.prev}${unit}`}</span>
      <span aria-hidden className="text-fg-faint">
        →
      </span>
      <span className="min-w-11 font-semibold text-fg">{d.now === null ? '—' : `${d.now}${unit}`}</span>
      <span className={`inline-flex min-w-19 items-center justify-end gap-0.5 text-note font-semibold ${diff ? (better ? 'text-success-strong' : 'text-warning-soft-fg') : 'text-fg-muted'}`}>
        {diff ? (
          <>
            <IconArrowUp size={14} aria-hidden className={diff < 0 ? 'rotate-180' : ''} />
            {better ? 'лучше' : 'хуже'}
          </>
        ) : (
          'как было'
        )}
      </span>
    </div>
  )
}

export function DiagnosticsSection({
  studentId,
  name,
  preloaded,
  last,
}: {
  studentId: string
  /** Имя из карточки — «в работах Айгерим». */
  name: string
  /**
   * Уже загруженная карта из карточки ученика. Без неё раздел лез в базу
   * второй раз за те же пять запросов: карточка считает по ним плашки, а
   * человек открывает раздел следом.
   */
  preloaded?: StudentDiagnostics | null
  /** Последнее занятие из расписания (lastLessonOf); null — не было или не загрузилось. */
  last: Lesson | null
}) {
  // Карта уже пришла сверху — второй запрос за теми же данными не делаем.
  const own = useAsyncData(
    () => (preloaded ? Promise.resolve(null) : getStudentDiagnostics(studentId)),
    [studentId, !!preloaded],
    'Не удалось загрузить диагностику',
  )
  const diag = preloaded ?? own.data
  // названия тем — из ленивых данных грамматики (только нужные языки)
  const titles = useTopicTitles(diag)
  // письма, ждущие проверки, и домашка — строки «Заданий» (d10-2)
  const extra = useAsyncData(
    async () => {
      const [writing, hw] = await Promise.all([listSubmittedWriting(), getHomework(studentId)])
      return { writing: writing.filter((w) => w.assignment.student_id === studentId), hw }
    },
    [studentId],
    'Не удалось загрузить письма и домашку',
  )

  if (!diag) return own.error ? <LoadError message={own.error} onRetry={own.reload} /> : <RowsSkeleton count={4} />

  const w = diag.words
  const hw = extra.data?.hw ?? null
  const hwp = homeworkProgress(hw)

  return (
    <>
      <SectionCard title="Динамика за месяц" note="было → стало">
        <div className="flex flex-col divide-y divide-line">
          <TrendRow label="Дни с занятиями" d={diag.dynamics.activeDays} />
          <TrendRow label="Средний балл работ" d={diag.dynamics.avgScore} unit="%" />
          <TrendRow label="Слов добавлено" d={diag.dynamics.wordsAdded} />
          <TrendRow label="Новых ошибок грамматики" d={diag.dynamics.newMistakes} moreIsBetter={false} />
          <TrendRow label="Идеальных дней" d={diag.dynamics.perfectDays} />
        </div>
        {diag.dynamics.learnedRecently > 0 && <p className="text-note text-fg-muted">За 30 дней выучено слов: {diag.dynamics.learnedRecently}</p>}
      </SectionCard>

      <div className="grid grid-cols-3 gap-2">
        {[
          { big: diag.activeDays14, small: ' из 14', label: 'дней с занятиями' },
          { big: w.total, label: 'слов в колоде' },
          { big: diag.avgPercent !== null ? `${diag.avgPercent}%` : '—', label: 'средний балл работ' },
        ].map((n) => (
          <div key={n.label} className="flex min-w-0 flex-col gap-0.5 rounded-control bg-surface px-3.5 py-3 shadow-card">
            <b className="text-2xl font-semibold leading-tight tabular-nums text-fg">
              {n.big}
              {n.small && <small className="text-sm font-medium text-fg-muted">{n.small}</small>}
            </b>
            <span className="text-note text-fg-secondary">{n.label}</span>
          </div>
        ))}
      </div>

      <SectionCard title="Слова" note={`${w.total} в колоде`}>
        <p className="flex flex-wrap gap-1.5 text-body text-fg-secondary">
          <span>
            новые <b className="font-semibold tabular-nums text-fg">{w.fresh}</b>
          </span>
          ·
          <span>
            учатся <b className="font-semibold tabular-nums text-fg">{w.learning}</b>
          </span>
          ·
          <span>
            выучено <b className="font-semibold tabular-nums text-fg">{w.learned}</b>
          </span>
        </p>
        {w.struggling.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-note font-semibold text-fg-muted">Буксуют</span>
            {w.struggling.map((s) => (
              <span key={s.front} lang="en" title={s.back ?? undefined} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-sm font-semibold text-warning-soft-fg">
                {s.front}
                <i className="not-italic font-medium">×{s.lapses}</i>
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Задания">
        {extra.error && <LoadError message={extra.error} onRetry={extra.reload} />}
        <div className="flex flex-col divide-y divide-line">
          {extra.data?.writing.map(({ assignment: a, task }) => (
            <TaskRow key={a.id} title={writingName(task)} meta={`сдано ${whenDone(a.submitted_at)}`} pill={<Pill tone="wait">Ждёт проверки</Pill>} />
          ))}
          {diag.assignments.map((a) => (
            <TaskRow
              key={a.id}
              title={`«${a.title}»`}
              meta={`материал · ${LANG_FLAG[a.lang]} ${a.level}`}
              pill={
                a.status === 'submitted' ? (
                  <Pill tone="wait">Ждёт проверки</Pill>
                ) : a.percent !== null ? (
                  <Pill tone="ok">
                    Проверено · {a.percent}%{a.fromAttempt ? ' (прошлая попытка)' : ''}
                  </Pill>
                ) : (
                  <Pill tone="plain">не сдано</Pill>
                )
              }
            />
          ))}
          {hw && hwp.total > 0 && <TaskRow title="Домашка на неделю" meta={dueShort(hw.due_at)} pill={<Pill tone="plain">{`${hwp.done} из ${hwp.total}`}</Pill>} />}
        </div>
        {extra.data && !extra.data.writing.length && !diag.assignments.length && !(hw && hwp.total) && (
          <p className="text-note text-fg-muted">Заданий пока не было.</p>
        )}
      </SectionCard>

      <SectionCard title="Грамматика — слабые темы">
        {!diag.mistakesAvailable ? (
          <p className="text-note text-warning-soft-fg">Таблица ошибок ещё не создана — выполни блок «ДИАГНОСТИКА» из supabase/migrations.</p>
        ) : diag.mistakes.length === 0 ? (
          <InfoBox>Пока пусто. Тема появится здесь, когда в работах {firstName(name)} наберётся несколько ошибок на одно правило.</InfoBox>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {diag.mistakes.map((m) => {
              const t = titles.get(`${m.lang}:${m.topicId}`)
              return (
                <TaskRow
                  key={`${m.lang}:${m.topicId}`}
                  title={t ? t.title : `тема №${m.topicId}`}
                  meta={`${LANG_FLAG[m.lang]}${t ? ` · ${t.level}` : ''}`}
                  pill={<Pill tone="wait">ошибок {m.count}</Pill>}
                />
              )
            })}
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-2.5 px-1 text-sm text-fg-secondary">
        <IconClock size={18} aria-hidden className="flex-none text-fg-muted" />
        {last ? (
          <span>
            Последнее занятие:{' '}
            <b className="font-medium text-fg">
              {dayShort(lessonDay(last))}, {timeRange(last)}
            </b>{' '}
            · {last.kind === 'group' ? (last.title ?? 'группа') : last.kind === 'trial' ? 'пробный' : 'индивидуальный'}
          </span>
        ) : (
          <span>Последнее занятие в приложении: {diag.lastActiveDay ? dayShort(diag.lastActiveDay) : 'не было'}</span>
        )}
      </p>
    </>
  )
}

/** Строка «Заданий» (d10-2): название, тихая подпись, метка справа. */
function TaskRow({ title, meta, pill }: { title: string; meta: string; pill: ReactNode }) {
  return (
    <div className="flex min-h-11.5 items-center gap-2.5 py-1 text-body">
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="truncate text-fg">{title}</span>
        {meta && <small className="truncate text-note text-fg-muted">{meta}</small>}
      </span>
      {pill}
    </div>
  )
}
