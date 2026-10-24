// ============================================================================
// Куски шага «Текст» мастера (макеты d8-4 «текст готов» и d8-5 «пока AI
// пишет»): статья с подсвеченными словами плана, упражнения с ответами,
// правки к тексту, «Назначится при сохранении» с уровнями и скелетон того же
// размера, пока AI пишет. Один набор на оба состояния — экран не прыгает,
// когда текст пришёл.
// ============================================================================
import type { ReactNode } from 'react'
import { Avatar } from '../../../shared/ui/Avatar'
import { Button } from '../../../shared/ui/Button'
import { fieldClass } from '../../../shared/ui/TextField'
import { IconRefresh, IconSparkle } from '../../../shared/ui/icons'
import { lengthLabel } from '../../../lib/materialLengths'
import type { MaterialRequest } from '../../../lib/materials'
import { FieldLabel, LANG_NAME } from './wizardBits'
import { markWords, paragraphs } from './markWords'
import type { StudentLevels } from './useStudentLevels'

/** «A2 · ~120 слов · английский · рассказ» под заголовком (d8-4 `.mt8`). */
function Meta({ req }: { req: MaterialRequest }) {
  const items = [req.level, lengthLabel(req.lengthRange), LANG_NAME[req.lang], req.format].filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className="rounded-full bg-input px-2.5 py-0.5 text-note font-medium text-fg-secondary">
          {it}
        </span>
      ))}
    </div>
  )
}

const ARTICLE = 'flex flex-col gap-3.5 rounded-card bg-surface px-7.5 pb-7 pt-6.5 shadow-card'

/** Статья (d8-4 `.art`): заголовок 28, строка о тексте, абзацы — слова плана подсвечены. */
export function Article({ req, title, body, words }: { req: MaterialRequest; title: string; body: string; words: string[] }) {
  return (
    <article className={ARTICLE}>
      <h2 lang={req.lang} className="text-greeting font-semibold">
        {title}
      </h2>
      <Meta req={req} />
      {paragraphs(body).map((p, i) => (
        <p key={i} lang={req.lang} className="whitespace-pre-line text-lg leading-relaxed text-fg">
          {markWords(p, words).map((piece, j) =>
            piece.hit ? (
              <mark key={j} className="rounded-mark bg-accent-soft px-0.5 font-medium text-accent-soft-fg">
                {piece.text}
              </mark>
            ) : (
              piece.text
            ),
          )}
        </p>
      ))}
    </article>
  )
}

/** «Упражнения (3) с ответами» (d8-4 `.exs`). */
export function ExercisesCard({ count, children }: { count: number; children: ReactNode }) {
  return (
    <section aria-label="Упражнения" className="flex flex-col gap-2.5 rounded-card bg-surface px-5.5 py-5 shadow-card">
      <h3 className="mb-1 flex items-baseline gap-2 text-lg font-semibold">
        Упражнения ({count})<small className="text-note font-normal text-fg-muted">с ответами</small>
      </h3>
      {children}
    </section>
  )
}

/** Серая полоса скелетона (d8-5 `.sk`). */
const Bar = ({ className }: { className: string }) => <span className={`animate-skeleton block rounded-tag bg-skeleton ${className}`} />

const LINES = [
  ['w-full', 'w-11/12', 'w-full', 'w-7/12'],
  ['w-full', 'w-full', 'w-11/12', 'w-3/4'],
  ['w-full', 'w-full', 'w-2/5'],
]

/** Пока AI пишет (d8-5): статья и упражнения той же формы, строка о тексте уже известна. */
export function TextSkeleton({ req, exercises }: { req: MaterialRequest; exercises: number }) {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true">
      <article className={ARTICLE}>
        <Bar className="h-7.5 w-3/5" />
        <Meta req={req} />
        {LINES.map((par, i) => (
          <span key={i} className="flex flex-col gap-3">
            {par.map((w, j) => (
              <Bar key={j} className={`h-3.5 ${w}`} />
            ))}
          </span>
        ))}
      </article>
      <ExercisesCard count={exercises}>
        {Array.from({ length: Math.min(exercises, 6) }, (_, i) => (
          <div key={i} className="flex gap-2.5 rounded-control-sm bg-input px-3 py-2.5">
            <span className="flex size-6 flex-none items-center justify-center rounded-tag bg-surface text-xs font-semibold text-fg-secondary">{i + 1}</span>
            <span className="flex flex-1 flex-col gap-2 py-1">
              <Bar className={`h-3.5 bg-surface! ${i % 2 ? 'w-11/12' : 'w-4/5'}`} />
              <Bar className={`h-3 bg-surface! ${i % 2 ? 'w-1/2' : 'w-2/5'}`} />
            </span>
          </div>
        ))}
      </ExercisesCard>
    </div>
  )
}

/** «✦ AI пишет текст •••» над правками (d8-5 `.aiw`). */
export function WritingNote() {
  return (
    <p role="status" className="flex items-center gap-2.5 rounded-control-sm bg-accent-soft px-3.5 py-3 text-body font-medium text-accent-soft-fg">
      <IconSparkle size={16} aria-hidden className="flex-none" />
      AI пишет текст
      <span aria-hidden className="ml-auto flex gap-1">
        {[0, 1, 2].map((i) => (
          <i key={i} className="size-1.5 animate-pulse rounded-full bg-current opacity-35 first:opacity-100" />
        ))}
      </span>
    </p>
  )
}

/** «Правки к тексту · необязательно» (d8-4: отдельная карточка над «Назначится»). */
export function TextFeedback({ value, onChange, disabled, lang }: { value: string; onChange: (v: string) => void; disabled: boolean; lang: string }) {
  return (
    <section aria-label="Правки к тексту" className="rounded-card bg-surface p-4.5 shadow-card">
      <label className="block">
        <FieldLabel opt>Правки к тексту</FieldLabel>
        <textarea
          lang={lang}
          className={`${fieldClass()} field-sizing-content min-h-19 py-3`}
          placeholder="Например: проще последний абзац"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </section>
  )
}

export interface AssignRow {
  id: string
  name: string
  level: string | null
}

/** «Назначится при сохранении»: кто с уровнем, кнопки и строка о генерациях (d8-4 `.sum8`). */
export function AssignCard({ rows, info, children }: { rows: AssignRow[]; info: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Сохранение" className="flex flex-col gap-3.5 rounded-card bg-surface p-4.5 shadow-card">
      <h2 className="text-note font-semibold text-fg-muted">{rows.length ? 'Назначится при сохранении' : 'Общий материал'}</h2>
      {rows.length === 0 && <p className="-mt-2 text-sm text-fg-secondary">Выдать ученикам можно потом, из библиотеки.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 text-body">
          <Avatar name={r.name} size={32} />
          <span className="min-w-0 flex-1 truncate">{r.name}</span>
          {r.level && <small className="text-note text-fg-muted">{r.level}</small>}
        </div>
      ))}
      <div className="flex flex-col gap-2 pt-1">{children}</div>
      <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm leading-snug text-fg-secondary tabular-nums">{info}</p>
    </section>
  )
}

/** Кому назначится — с уровнем в языке материала. */
export const assignRows = (ids: string[], lang: MaterialRequest['lang'], levels: StudentLevels): AssignRow[] =>
  ids.map((id) => ({ id, name: levels.nameOf(id), level: levels.levelOf(id, lang) }))

/** Правая колонка, пока AI пишет (d8-5): всё на месте, но выключено. */
export function WritingAside({ ids, req, levels }: { ids: string[]; req: MaterialRequest; levels: StudentLevels }) {
  return (
    <>
      <WritingNote />
      <TextFeedback value="" onChange={() => {}} disabled lang={req.lang} />
      <AssignCard rows={assignRows(ids, req.lang, levels)} info="План сохранён: «План» в шагах вверху вернёт к нему, генерация не спишется, пока текст не готов">
        <Button className="w-full" disabled>
          {saveLabel(ids.length)}
        </Button>
        <Button variant="outline" size="sm" className="w-full" disabled>
          <IconRefresh size={16} aria-hidden /> Перегенерировать
        </Button>
      </AssignCard>
    </>
  )
}

/** «Сохранить и выдать двоим» — по числу учеников. */
export function saveLabel(n: number): string {
  if (n === 0) return 'Сохранить в библиотеку'
  if (n === 1) return 'Сохранить и выдать'
  if (n === 2) return 'Сохранить и выдать двоим'
  if (n === 3) return 'Сохранить и выдать троим'
  return `Сохранить и выдать ${n} ученикам`
}
