// ============================================================================
// Витрина дизайн-системы — /dev/ui, ТОЛЬКО в разработке: в сборку для людей
// не попадает (app/routeChunks, import.meta.env.DEV).
//
// Зачем. Общие компоненты, токены обеих тем и раскладки на одной странице —
// так их проверяют глазами и смоуком (scripts/smoke-ui.mjs) на 1280 и 390,
// пока ни один старый экран раскладки не использует: экраны берут их при
// переезде (PLAN.md Ф3), новые экраны Ф2 — сразу.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { useUrlState } from '../../shared/lib/useUrlState'
import { BackHeader } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { HowItWorks } from '../../shared/ui/HowItWorks'
import { IconCards, IconGraduation, IconMaterials, IconTeacher } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading, RowsSkeleton } from '../../shared/ui/Loading'
import { Picker } from '../../shared/ui/Picker'
import { RowCard } from '../../shared/ui/RowCard'
import { Sheet } from '../../shared/ui/Sheet'
import { TabPicker } from '../../shared/ui/TabPicker'
import { ThemePicker } from '../../shared/ui/ThemePicker'
import { Thinking } from '../../shared/ui/Thinking'
import { ExerciseView } from '../../components/exercises'
import { LAYOUTS, LayoutDemo, type LayoutId } from './ShowcaseLayouts'

// Классы — строками целиком: Tailwind находит утилиты по тексту исходника.
const SWATCHES = [
  ['page', 'bg-page'],
  ['surface', 'bg-surface'],
  ['input', 'bg-input'],
  ['fg', 'bg-fg'],
  ['fg-muted', 'bg-fg-muted'],
  ['fg-faint', 'bg-fg-faint'],
  ['accent', 'bg-accent'],
  ['accent-soft', 'bg-accent-soft'],
  ['danger', 'bg-danger'],
  ['warning', 'bg-warning'],
  ['success', 'bg-success'],
] as const

const TEXTS = [
  ['fg', 'text-fg'],
  ['fg-secondary', 'text-fg-secondary'],
  ['fg-tertiary', 'text-fg-tertiary'],
  ['fg-muted', 'text-fg-muted'],
  ['accent-strong', 'text-accent-strong'],
  ['danger-strong', 'text-danger-strong'],
  ['warning-strong', 'text-warning-strong'],
  ['success-strong', 'text-success-strong'],
] as const

const MCQ = {
  type: 'mcq' as const,
  prompt: 'She ___ to school every day.',
  options: ['go', 'goes', 'going', 'gone'],
  answer: 1,
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-micro uppercase tracking-wider text-fg-muted">{title}</h2>
      {children}
    </section>
  )
}

export function UiShowcase() {
  const [layout, setLayout] = useUrlState('l', (v) => LAYOUTS.some((l) => l.id === v))
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a')
  const [pick, setPick] = useState<'x' | 'y'>('x')
  const [sheet, setSheet] = useState(false)
  const [answered, setAnswered] = useState(0)
  const [round, setRound] = useState(0)

  if (layout) return <LayoutDemo id={layout as LayoutId} onBack={() => setLayout(null)} />

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight">Витрина дизайн-системы</h1>

      <Section title="Тема этого устройства">
        <ThemePicker />
      </Section>

      <Section title="Цвета">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <span className={`h-10 rounded-xl border border-tint/[0.10] ${cls}`} />
              <span className="text-caption text-fg-muted">{name}</span>
            </div>
          ))}
        </div>
        <Card className="flex flex-col gap-1">
          {TEXTS.map(([name, cls]) => (
            <p key={name} className={`text-sm ${cls}`}>
              {name} — Съешь же ещё этих мягких французских булок
            </p>
          ))}
        </Card>
      </Section>

      <Section title="Кнопки">
        <div className="flex flex-wrap gap-2">
          <Button>Главная</Button>
          <Button variant="secondary">Вторичная</Button>
          <Button variant="ghost">Тихая</Button>
          <Button variant="danger">Удалить</Button>
          <Button loading>Жду</Button>
        </div>
      </Section>

      <Section title="Карточки и строки">
        <RowCard Icon={IconMaterials} title="Строка списка" desc="Подпись строки" onClick={() => {}} />
        <RowCard Icon={IconCards} title="Активная" desc="Акцентная подложка иконки" active onClick={() => {}} />
        <RowCard Icon={IconTeacher} title="Предложение" desc="Пунктирная рамка" dashed onClick={() => {}} />
        <RowCard Icon={IconGraduation} title="Сделано" desc="Приглушённая" muted onClick={() => {}} />
      </Section>

      <Section title="Переключатели">
        <TabPicker
          ariaLabel="Вкладки"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'a', label: 'Первая' },
            { id: 'b', label: 'Вторая' },
            { id: 'c', label: 'Третья' },
          ]}
        />
        <TabPicker
          ariaLabel="Сегмент"
          variant="segment"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'a', label: 'Чат' },
            { id: 'b', label: 'Письмо' },
          ]}
        />
        <Picker
          label="Выбор из списка"
          value={pick}
          onChange={setPick}
          options={[
            { id: 'x', label: 'Вариант X' },
            { id: 'y', label: 'Вариант Y', hint: 'с подсказкой' },
          ]}
        />
      </Section>

      <Section title="Состояния">
        <HowItWorks>Свёрнутое пояснение раскрывается плавно и монтируется, только пока открыто.</HowItWorks>
        <Thinking label="AI думает" />
        <Loading label="Готовим" />
        <RowsSkeleton count={2} />
        <LoadError message="Не удалось загрузить" onRetry={() => {}} />
      </Section>

      <Section title="Шторка">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Открыть шторку
        </Button>
        {sheet && (
          <Sheet onClose={() => setSheet(false)} labelledBy="demo-sheet">
            <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-1">
              <h2 id="demo-sheet" className="text-lg font-medium">
                Шторка
              </h2>
              <p className="mt-2 text-sm text-fg-muted">
                На телефоне — снизу, тянется за ручку. На компьютере — панель справа на всю высоту.
              </p>
            </div>
          </Sheet>
        )}
      </Section>

      <Section title="Раскладки">
        {LAYOUTS.map((l) => (
          <RowCard key={l.id} Icon={l.Icon} title={l.title} desc={l.desc} onClick={() => setLayout(l.id)} />
        ))}
      </Section>

      <Section title="Клавиатура: 1–4, Enter">
        <p className="text-sm text-fg-muted" data-demo="keys">
          Отвечено: {answered} · вопрос {round + 1}
        </p>
        <ExerciseView
          key={round}
          exercise={MCQ}
          onAnswered={() => setAnswered((n) => n + 1)}
          onNext={() => setRound((r) => r + 1)}
          isLast={false}
        />
      </Section>

      <BackHeader title="Строка «назад»" onBack={() => window.history.back()} />
    </div>
  )
}
