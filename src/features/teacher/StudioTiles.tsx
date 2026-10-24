// ============================================================================
// Плашки и плитки карточки ученика (макеты t6-2, d10-1; PLAN.md Ф2.11б-2,
// Ф2.17-4б-2).
//
// Три плашки под домашкой — то, за чем преподаватель и приходит: буксующие
// слова, слабая тема, сколько дней ученик занимался. Нажатие — в раздел, где
// это видно подробно.
//
// Ниже «Разделы» — шесть плиток вместо раскрывашек: значок в мягком
// квадрате, название и короткая строка — состояние («9 из 14 дней»,
// «3 буксуют», «неделя 2 из 8») или, если в разделе пусто, главное действие
// акцентом («Назначить», «Составить»). Колонок две, в широкой карточке — три
// (контейнер карточки, а не окно); в узкой (телефон, t6-2) значок без
// квадрата и название в две строки — квадрат съедал ширину плитки 175 px. Плитка —
// одна кнопка: две цели в маленькой плитке — промах пальцем; само действие —
// на экране раздела. Решение владельца 10.10.2026.
//
// ⚠️ Сбой — не «пусто» (Ф1.13): не загрузилось — «—», а не «Назначить»
// второй тест поверх ждущего. Числа — из общей диагностики (lib/diagnostics),
// второго счёта рядом нет.
// ============================================================================
import { dateAt } from '../../domains/schedule'
import type { StudentDiagnostics } from '../../lib/diagnostics'
import { listPlacements, type PlacementRequest } from '../../lib/placement'
import { currentWeekIndex, getActivePlan } from '../../lib/studyPlan'
import { REGULARITY_WINDOW } from '../../lib/activityDays'
import { plural } from '../../shared/lib/plural'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import type { AppLang } from '../../types'
import { STUDIO_SECTIONS, type StudioSection } from './studioSections'
import { topicTitle, useTopicTitles } from './topicTitles'

/** Поверхность плашки и плитки (d10-1): без рамки, тень только в светлой. */
const surface = 'bg-surface text-left shadow-card transition-colors active:bg-row-press'

/** Три плашки (t6-2): подпись сверху, значение снизу. diag = null после загрузки — «—». */
export function StatTiles({
  diag,
  loading,
  onOpen,
}: {
  diag: StudentDiagnostics | null
  loading: boolean
  onOpen: (section: StudioSection) => void
}) {
  const titles = useTopicTitles(diag)
  const top = diag ? [...diag.mistakes].sort((a, b) => b.count - a.count)[0] : undefined
  // ⚠️ Ноль и «неизвестно» — разные вещи: «0 буксующих слов» при упавшем
  // запросе выглядит как хорошая новость, хотя мы просто ничего не знаем.
  const tiles: { label: string; to: StudioSection; value: React.ReactNode }[] = [
    {
      label: 'Буксующие слова',
      to: 'words',
      value: !diag ? '—' : diag.words.total === 0 ? <Soft block>появятся позже</Soft> : diag.words.struggling.length,
    },
    {
      label: 'Слабая тема',
      to: 'diag',
      value: !diag ? '—' : top ? <span className="block text-body font-semibold leading-tight">{topicTitle(titles, top.lang, top.topicId)}</span> : <Soft block>пока нет</Soft>,
    },
    {
      // ⚠️ Ровно то же окно и число, что в строке списка (activeDays7):
      // две цифры про одно и то же обесценивают друг друга.
      label: 'Занятия',
      to: 'diag',
      value: !diag ? '—' : (
        <>
          {diag.activeDays7}
          <Soft> из {REGULARITY_WINDOW} дн.</Soft>
        </>
      ),
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2" data-stat-tiles>
      {tiles.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onOpen(t.to)}
          className={`${surface} flex min-h-25 min-w-0 flex-col justify-between gap-1.5 rounded-control-lg p-3`}
        >
          <span className="text-xs leading-tight text-fg-muted">{t.label}</span>
          <span className="break-words text-2xl font-semibold leading-tight tabular-nums">
            {loading ? <span className="animate-skeleton inline-block h-6 w-8 rounded-tag bg-skeleton" /> : t.value}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Слова вместо числа. block — само по себе (свой межстрочный, а не от крупной цифры). */
function Soft({ children, block = false }: { children: React.ReactNode; block?: boolean }) {
  // 14 px, а не 15, как в макете: шрифт приложения шире, и «диагностики» в
  // плашке на 390 px переносилось по слогам
  return <span className={`${block ? 'block ' : ''}text-body font-medium leading-tight text-fg-muted`}>{children}</span>
}

type TileState = { text: string; action?: boolean } | 'loading' | 'error'

/** «Ещё» и шесть плиток разделов. */
export function SectionTiles({
  studentId,
  level,
  diag,
  diagLoading,
  lang,
  onOpen,
}: {
  studentId: string
  /** Уровень из профиля ученика (сам проходил тест); null — не знаем. */
  level: string | null
  diag: StudentDiagnostics | null
  diagLoading: boolean
  /** Язык студии (EN/ES в шапке) — программа у ученика своя на каждый язык. */
  lang: AppLang
  onOpen: (section: StudioSection) => void
}) {
  const placements = useAsyncData(() => listPlacements(studentId), [studentId])
  const program = useAsyncData(() => getActivePlan(studentId, lang), [studentId, lang])

  const fromDiag = (make: (d: StudentDiagnostics) => TileState): TileState =>
    diag ? make(diag) : diagLoading ? 'loading' : 'error'
  const states: Record<StudioSection, TileState> = {
    // «9 из 14 дней» с занятиями — окно 14 дней, как у диагностики (в d10-1 «… активна»: пол ученика мы не знаем)
    diag: fromDiag((d) => ({ text: `${d.activeDays14} из 14 дней` })),
    program: program.error ? 'error' : program.loading ? 'loading' : programState(program.data),
    words: fromDiag((d) =>
      !d.words.total
        ? { text: 'Выдать', action: true }
        : d.words.struggling.length
          ? { text: `${d.words.struggling.length} ${plural(d.words.struggling.length, 'буксует', 'буксуют', 'буксуют')}` }
          : { text: `${d.words.total} ${plural(d.words.total, 'слово', 'слова', 'слов')}` },
    ),
    placement: placements.error ? 'error' : placements.loading ? 'loading' : placementState(placements.data ?? [], level),
    quests: fromDiag((d) => {
      const active = d.quests.filter((q) => q.status === 'assigned').length
      const done = d.quests.length - active
      if (active) return { text: `${active} в процессе` }
      return done ? { text: `пройдено ${done}` } : { text: 'Назначить первый', action: true }
    }),
    report: { text: 'лист для печати' },
  }

  return (
    <>
      <p className="-mb-1 mt-2 px-1 text-note font-medium text-fg-muted">Разделы</p>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3" data-section-tiles>
        {STUDIO_SECTIONS.map(({ id, title, Icon }) => {
          const st = states[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              data-tile={id}
              className={`${surface} flex min-h-18 min-w-0 items-center gap-2 rounded-control px-3 py-2.5 @lg:gap-3 @lg:px-3.5`}
            >
              <span className="flex flex-none items-center justify-center text-accent-strong @lg:size-10 @lg:rounded-tile @lg:bg-accent-soft">
                <Icon size={20} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
                <span className="break-words text-body font-semibold text-fg @lg:truncate">{title}</span>
                {st === 'loading' ? (
                  <span className="animate-skeleton mt-1 block h-3 w-16 rounded-full bg-skeleton" />
                ) : (
                  <span
                    className={`truncate text-note ${st !== 'error' && st.action ? 'font-medium text-accent-strong' : 'text-fg-muted'}`}
                  >
                    {st === 'error' ? '—' : st.text}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function programState(plan: Awaited<ReturnType<typeof getActivePlan>> | null): TileState {
  if (!plan) return { text: 'Составить', action: true }
  return { text: `неделя ${currentWeekIndex(plan)} из ${plan.weeks.length}` }
}

/** Ждём результат → последний результат → уровень из профиля → «Назначить». */
function placementState(rows: PlacementRequest[], level: string | null): TileState {
  if (rows.some((r) => r.status === 'assigned')) return { text: 'ждём результат' }
  const done = rows.find((r) => r.status === 'done' && r.result_level)
  if (done) {
    const date = done.completed_at && dateAt(done.completed_at)
    return { text: date ? `${done.result_level} · ${date}` : `${done.result_level}` }
  }
  if (level) return { text: level }
  return { text: 'Назначить', action: true }
}
