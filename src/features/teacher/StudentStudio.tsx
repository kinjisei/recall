import { useState } from 'react'
import { IconFlame } from '../../shared/ui/icons'
import { GOAL_LABELS } from '../../types'
import { useUrlState } from '../../shared/lib/useUrlState'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { Reveal } from '../../shared/ui/Reveal'
import { useLanguage } from '../../context/LanguageContext'
import { setStudentSeat, unlinkStudent, type StudentInfo } from '../../lib/teacher'
import { getStudentDiagnostics } from '../../lib/diagnostics'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { StudentWordsSection } from './StudentWordsSection'
import { QuestSection } from './QuestSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { DailyPlanSection } from './DailyPlanSection'
import { HomeworkSection, StatTiles } from './HomeworkSection'
import { HomeworkComposer } from './HomeworkComposer'

/**
 * Разделы под «Ещё» — то, что нужно раз в месяц. Порядок значим: тест уровня
 * первым, потому что с нового ученика начинают именно с него (это и в
 * методичке, и в комментариях кода стояло всегда, а на экране — нет).
 * `short` — имя в подписи «Ещё: …».
 */
const SECTIONS = [
  { id: 'placement', title: 'Тест уровня', short: 'тест уровня' },
  { id: 'diag', title: 'Диагностическая карта', short: 'диагностика' },
  { id: 'plan', title: 'План дня', short: 'план дня' },
  { id: 'program', title: 'Программа обучения', short: 'программа' },
  { id: 'words', title: 'Слова и перепроверка', short: 'слова' },
  { id: 'quests', title: 'AI-квесты по грамматике', short: 'квесты' },
] as const

type StudentSection = (typeof SECTIONS)[number]['id']

/**
 * Подпись собирается из самого списка: написанная рукой, она называла 4
 * раздела из 6 — план дня и квесты было не найти (PLAN.md Ф2.11).
 */
const MORE_LABEL = `Ещё: ${SECTIONS.map((s) => s.short).join(', ')}`

/**
 * Студия ученика в приложении — под шапкой карточки (features/students):
 * домашка, три плашки, «Ещё», место тарифа и отвязка. Имя, статус и связь —
 * в шапке, здесь их нет.
 */
export function StudentStudio({
  student,
  name,
  onChanged,
  covered = true,
  seatsKnown = false,
}: {
  student: StudentInfo
  /** Имя из карточки — подпись учителя. */
  name: string
  onChanged: () => void
  /** Покрыт ли ученик тарифом: сверх мест AI-возможности у него обычные, бесплатные. */
  covered?: boolean
  /** Можно ли ему дать место (есть лимит мест и статус занимает место). */
  seatsKnown?: boolean
}) {
  const { lang: appLang } = useLanguage()
  const [seatBusy, setSeatBusy] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = student.profile

  // ⚠️ Раскрытый раздел живёт в АДРЕСЕ, как на остальных 12 экранах: в PWA
  // свайп-назад — единственный способ вернуться, и без этого он выбрасывал бы
  // из карточки целиком вместо закрытия раздела. Открыт максимум один раздел:
  // раскрытые подряд диагностика с программой давали экран, который
  // невозможно пролистать.
  const [rawSection, setRawSection] = useUrlState('sec', (v) =>
    SECTIONS.some((s) => s.id === v),
  )
  const section = rawSection as StudentSection | null
  const setSection = (v: StudentSection | null) => setRawSection(v)
  const [more, setMore] = useState(!!section)
  const [composing, setComposing] = useState(false)
  /** Растёт после выдачи домашки — блок перечитывает себя, карточка не мигает. */
  const [hwVersion, setHwVersion] = useState(0)

  // Числа для плашек берём из ОБЩЕЙ диагностики (lib/diagnostics), а не считаем
  // рядом: второй счёт разошёлся бы с картой молча, и учитель увидел бы в
  // карточке одно, а в разделе — другое.
  // Сбой — плашки покажут «—» вместо чисел: карточка из-за них не падает.
  const { data: diag, loading: diagLoading } = useAsyncData(() => getStudentDiagnostics(p.id), [p.id])

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-fg-muted">
              {/* Уровня может НЕ БЫТЬ: пока ученик не прошёл тест, мы его не
                  знаем (раньше стояло умолчание колонки «B1»). */}
              {p.level ? `Уровень ${p.level}` : 'Уровень не определён'} ·{' '}
              <IconFlame size={13} className="inline align-text-bottom" /> {student.streak} ·{' '}
              {student.doneToday ? 'сегодня ✓' : 'сегодня —'}
            </p>
            {/* Цель — то, ради чего ученик пришёл: у готовящегося к IELTS и у
                школьника занятия строятся по-разному. */}
            {p.goal && <p className="mt-0.5 text-sm text-accent-strong">Цель: {GOAL_LABELS[p.goal]}</p>}
          </div>
          <p className="text-right text-sm text-fg-muted">
            за 7 дней:
            <br />
            <span className="text-lg font-bold text-fg-secondary">{student.weekItems}</span> заданий
          </p>
        </div>

        {/* 1. Домашка — первой: единственное, что нужно и до урока, и после. */}
        <HomeworkSection studentId={p.id} reloadKey={hwVersion} onCompose={() => setComposing(true)} />

        {/* 2. Три числа, за которыми преподаватель и приходит. */}
        <StatTiles
          diag={
            diag
              ? {
                  struggling: diag.words.struggling.length,
                  weakTopics: diag.mistakes.length,
                  // ⚠️ Ровно то же число, что в строке списка (activeDays7):
                  // две цифры про одно и то же обесценивают друг друга.
                  activeDays: diag.activeDays7,
                }
              : null
          }
          loading={diagLoading}
        />

        {/* 3. Всё остальное — под «Ещё»: нужно раз в месяц, а занимало экран каждый раз. */}
        <button
          onClick={() => {
            const next = !more
            setMore(next)
            if (!next) setSection(null)
          }}
          aria-expanded={more}
          className="mt-1 flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-accent-strong"
        >
          {more ? '▾' : '▸'} {MORE_LABEL}
        </button>

        <Reveal open={more}>
          <div className="flex flex-col gap-2 pt-1">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => setSection(section === s.id ? null : s.id)}
                  aria-expanded={section === s.id}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-tint/[0.08] bg-tint/[0.03] px-3.5 text-left text-sm"
                >
                  <span>{s.title}</span>
                  <span className="text-fg-muted">{section === s.id ? '▾' : '▸'}</span>
                </button>
                <Reveal open={section === s.id}>
                  <div className="pt-2">
                    {s.id === 'placement' && <PlacementSection studentId={p.id} studentName={name} />}
                    {s.id === 'diag' && <DiagnosticsSection studentId={p.id} studentName={name} preloaded={diag} />}
                    {s.id === 'plan' && <DailyPlanSection studentId={p.id} />}
                    {s.id === 'program' && <ProgramSection studentId={p.id} />}
                    {s.id === 'words' && <StudentWordsSection studentId={p.id} studentLevel={p.level ?? null} />}
                    {s.id === 'quests' && <QuestSection studentId={p.id} />}
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </Reveal>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-tint/[0.06] pt-3">
          {seatsKnown && (
            <Button
              variant="ghost"
              className="min-h-11 px-3 py-2 text-sm"
              loading={seatBusy}
              onClick={async () => {
                setSeatBusy(true)
                setError(null)
                try {
                  await setStudentSeat(p.id, !covered)
                  onChanged()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Не удалось изменить место')
                } finally {
                  setSeatBusy(false)
                }
              }}
            >
              {covered ? 'Освободить место тарифа' : 'Дать место тарифа'}
            </Button>
          )}
          <Button
            variant="ghost"
            className="min-h-11 px-3 py-2 text-sm text-danger-soft-fg"
            loading={unlinking}
            onClick={async () => {
              const ok = window.confirm(
                `Отвязать ${name} от приложения? Аккаунт и прогресс останутся у ученика, карточка — в твоём списке, но ты перестанешь видеть занятия и не сможешь назначать задания.`,
              )
              if (!ok) return
              setUnlinking(true)
              setError(null)
              try {
                await unlinkStudent(p.id)
                onChanged()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Не удалось отвязать')
                setUnlinking(false)
              }
            }}
          >
            Отвязать
          </Button>
        </div>
      </Card>

      {composing && (
        <HomeworkComposer
          studentId={p.id}
          studentName={name}
          // ⚠️ Язык — из переключателя EN/ES в шапке, как весь раздел
          // преподавателя (см. WordPicker), а не profile.native_lang: это РОДНОЙ
          // язык ученика, и пункт «слова» считал бы не ту колоду.
          lang={appLang}
          // Уровень нужен подбору текста; null (тест не проходили) подбор не завышает.
          level={p.level ?? null}
          onClose={() => setComposing(false)}
          onCreated={() => setHwVersion((v) => v + 1)}
        />
      )}
    </div>
  )
}
