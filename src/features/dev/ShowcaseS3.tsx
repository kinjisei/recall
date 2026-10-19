// ============================================================================
// Витрина листа s3 («Основа стиля · компоненты») на настоящих компонентах:
// те же разделы и состояния, что на макете, — сверка снимками в четырёх
// вариантах вида (выбор — «Вид этого устройства» вверху /dev/ui).
// Нажатое состояние без пальца — атрибут data-press (его понимают кнопки,
// чипы и строки); фокус поля — те же классы, что даёт :focus.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { Avatar } from '../../shared/ui/Avatar'
import { Badge } from '../../shared/ui/Badge'
import { Banner } from '../../shared/ui/Banner'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { CountBadge } from '../../shared/ui/CountBadge'
import { EmptyState } from '../../shared/ui/EmptyState'
import { IconButton } from '../../shared/ui/IconButton'
import { IconArchive, IconBook, IconClipboard, IconMore, IconPause, IconSpark, IconUserPlus, IconWarning } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { RowCard } from '../../shared/ui/RowCard'
import { Switch } from '../../shared/ui/Switch'
import { TabPicker } from '../../shared/ui/TabPicker'
import { TextField, fieldClass } from '../../shared/ui/TextField'
import { ToastView } from '../../shared/ui/UndoToast'

/** Поставить data-press на n-й элемент по селектору внутри обёртки. */
function Pressed({ children, sel = '*', n = 0 }: { children: ReactNode; sel?: string; n?: number }) {
  return (
    <div className="contents" ref={(el) => el?.querySelectorAll(sel)[n]?.setAttribute('data-press', '')}>
      {children}
    </div>
  )
}

export function Board({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" data-board={title}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-note text-fg-muted">{note}</p>
      {children}
    </section>
  )
}

const STATES = ['обычное', 'нажатое', 'выключенное', 'загрузка'] as const
const KINDS = [
  ['Главная', 'primary', 'Сохранить'],
  ['Вторичная', 'secondary', 'Перенести'],
  ['Тихая', 'ghost', 'Не сейчас'],
  ['Опасная', 'danger', 'Отменить урок'],
] as const

function Buttons() {
  return (
    <Board title="Кнопки" note="Высота 48 (главная на экране — 56–60, радиус 18). Нажатая: тон темнее + scale .97. Выключенная: подложка input и текст fg-faint. Загрузка держит ширину.">
      {/* лист рисует сетку для компьютера; уже — прокручивается вбок, а не жмёт подписи */}
      <div className="grid grid-cols-[6rem_repeat(4,minmax(7.5rem,1fr))] items-center gap-1.5 overflow-x-auto pb-1">
        <span />
        {STATES.map((s) => (
          <span key={s} className="text-micro font-semibold uppercase text-fg-muted">
            {s}
          </span>
        ))}
        {KINDS.map(([label, variant, text]) => (
          <div key={variant} className="contents">
            <span className="text-note text-fg-secondary">{label}</span>
            {/* на листе в сетке состояний текст 14 — иначе «Отменить урок» не влезает */}
            <Button variant={variant} className="whitespace-nowrap px-2 text-sm">{text}</Button>
            <Button variant={variant} className="whitespace-nowrap px-2 text-sm" data-press="">{text}</Button>
            <Button variant={variant} className="whitespace-nowrap px-2 text-sm" disabled>{text}</Button>
            <Button variant={variant} className="whitespace-nowrap px-2 text-sm" loading>{text}</Button>
          </div>
        ))}
        <span className="text-note text-fg-secondary">Иконка 44 × 44</span>
        <IconButton label="Ещё"><IconMore /></IconButton>
        <IconButton label="Ещё" data-press=""><IconMore /></IconButton>
        <IconButton label="Ещё" disabled><IconMore /></IconButton>
        <IconButton label="Ещё" loading><IconMore /></IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Малая 44</Button>
        <Button>Обычная 48</Button>
        <Button size="lg">Главная 56</Button>
        <Button variant="danger-solid">Удалить — подтверждение</Button>
      </div>
    </Board>
  )
}

function Fields() {
  return (
    <Board title="Поле ввода" note="Подпись над полем — всегда. Текст в поле 16 px. Ошибка — рамка danger + иконка + фраза; после ухода из поля.">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <TextField label="Ссылка на урок" placeholder="meet.google.com/…" hint="Ученик увидит её в «Ближайшем уроке»" />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg-secondary">Ссылка на урок · фокус</span>
          <input
            readOnly
            value="meet.google.com/kzr-mdsn-tqp"
            aria-label="Ссылка на урок · фокус"
            className={`${fieldClass()} border-accent! inset-ring-1 inset-ring-accent ring-2 ring-focus ring-offset-2 ring-offset-page`}
          />
          <span className="text-note text-fg-muted">Ученик увидит её в «Ближайшем уроке»</span>
        </div>
        <TextField label="Начало урока" inputMode="numeric" defaultValue="25:00" error="Укажи время от 00:00 до 23:59" showError />
        <TextField label="Ссылка на урок · выключено" defaultValue="meet.google.com/kzr-mdsn-tqp" hint="Доступно на тарифе" disabled />
      </div>
    </Board>
  )
}

function Choice() {
  const [len, setLen] = useState<'45' | '60' | '90' | '120'>('60')
  const [view, setView] = useState<'day' | 'week'>('day')
  const [on, setOn] = useState(true)
  const [off, setOff] = useState(false)
  return (
    <Board title="Выбор: чипы, сегмент, тумблер" note="Выбранный чип — галочка и рамка accent. Сегмент — 2–3 вида одного и того же. Тумблер включает сразу; главный сигнал — положение ручки. Цели — 44.">
      <Pressed sel="[role=radio]" n={2}>
        <ChoiceGroup
          label="Длительность"
          value={len}
          onChange={setLen}
          options={[
            { id: '45', label: '45 мин' },
            { id: '60', label: '1 ч' },
            { id: '90', label: '1,5 ч' },
            { id: '120', label: '2 ч', disabled: true },
          ]}
        />
      </Pressed>
      <TabPicker
        variant="segment"
        ariaLabel="Вид расписания"
        value={view}
        onChange={setView}
        options={[
          { id: 'day', label: 'День' },
          { id: 'week', label: 'Неделя' },
        ]}
      />
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-row bg-surface px-4 shadow-card">
        <Switch label="Напоминать о скором уроке" checked={on} onChange={setOn} />
        <Switch label="Напоминать о скором уроке" checked={off} onChange={setOff} />
        <Switch label="Напоминать о скором уроке" checked disabled onChange={() => {}} />
      </div>
    </Board>
  )
}

function Rows() {
  return (
    <Board title="Строка списка" note="Иконка или аватар 40 + заголовок 16 + подпись 13 + шеврон или значение. Высота ≥ 64; нажатая — подложка на всю строку. Третья строка — нажатая.">
      <Pressed sel="button" n={2}>
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-row bg-surface shadow-card">
          <RowCard flat active Icon={IconBook} title="Чтение" desc="Тексты с переводом слова по тапу" onClick={() => {}} />
          <RowCard flat lead={<Avatar name="Тимур Ким" cardOnly />} title="Тимур Ким" desc="вт и чт, 10:00–11:00" trailing={<span className="text-body tabular-nums text-fg-secondary">осталось 1</span>} onClick={() => {}} />
          <RowCard flat lead={<Avatar name="Айгерим Нурланова" />} title="Айгерим Нурланова" desc="B1 · вт и чт, 19:00–20:00" trailing={<span className="text-body tabular-nums text-fg-secondary">осталось 3</span>} onClick={() => {}} />
        </div>
      </Pressed>
    </Board>
  )
}

function Cards() {
  return (
    <Board title="Карточка, статусная карточка, плашка" note="Карточка — surface, радиус 24, отступ 16. Статусная — фон и рамка статуса, иконка + текст -strong, одно действие. Плашка — на всю ширину, без радиуса.">
      <div className="-mx-4 flex flex-col gap-3">
        <Banner action={<button type="button">Продлить</button>}>Тариф «Репетитор Mini» кончается завтра</Banner>
        <Banner tone="accent" action={<button type="button">Выбрать тариф</button>}>
          Только просмотр: тариф закончился
        </Banner>
      </div>
      <Card className="flex flex-col gap-1.5">
        <span className="text-lg font-semibold">Ближайший урок</span>
        <span className="text-body tabular-nums">Сегодня, 19:00–20:00 · английский с Мадиной</span>
      </Card>
      <Card tone="warning" className="flex gap-3">
        <IconWarning size={20} className="mt-px flex-none text-warning-strong" />
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold text-warning-strong">У Тимура Кима остался 1 оплаченный урок</p>
          <p className="text-body text-fg-secondary">Напомни об оплате, если нужно — сам Recall ученику не пишет.</p>
          <Button variant="secondary" size="sm" className="mt-2">
            Напомнить
          </Button>
        </div>
      </Card>
      <LoadError message="Не удалось загрузить расписание" onRetry={() => {}} />
    </Board>
  )
}

function Badges() {
  return (
    <Board title="Бейджи, счётчик, аватары" note="Статус — цвет + значок + слово. Счётчик — до 99, дальше «99+». Аватар — инициалы; пунктир — без приложения; группа — иконка.">
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent" Icon={IconSpark}>пробный</Badge>
        <Badge tone="success" dot>занимается</Badge>
        <Badge tone="neutral" Icon={IconPause}>пауза</Badge>
        <Badge tone="outline" Icon={IconArchive}>архив</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <span className="flex w-21 flex-col items-center gap-0.5 text-xs font-medium text-fg-muted">
          <span className="relative flex">
            <IconClipboard />
            <CountBadge n={2} className="-right-3 -top-1.5" />
          </span>
          Задания
        </span>
        <span className="relative mr-4 flex">
          <IconClipboard />
          <CountBadge n={120} className="-right-6 -top-1.5" />
        </span>
        <Avatar name="Айгерим Нурланова" size={56} />
        <Avatar name="Әсел Жұмабаева" />
        <Avatar name="Нұрсұлтан Ахметов" />
        <Avatar name="Кайрат Оспанов" cardOnly />
        <Avatar name="IELTS вечер" group />
        <Avatar name="Мейір Сапар" size={32} />
      </div>
    </Board>
  )
}

function States() {
  return (
    <Board title="Тост «Вернуть», пустое состояние, загрузка" note="Тост — над панелью вкладок, ~5 секунд. Пустое — иконка, одна фраза и одно действие. Скелетон повторяет раскладку; при «уменьшить движение» — статичный.">
      <ToastView text="Урок перенесён" onAction={() => {}} />
      <div className="grid gap-4 sm:grid-cols-2">
        <EmptyState Icon={IconUserPlus} title="Учеников пока нет" actions={<Button>Добавить ученика</Button>}>
          Добавь первого — и сможешь вести его уроки и оплату
        </EmptyState>
        <RowsSkeleton count={4} />
      </div>
    </Board>
  )
}

export function ShowcaseS3() {
  return (
    <div className="flex flex-col gap-10" data-sheet="s3">
      <Buttons />
      <Fields />
      <Choice />
      <Rows />
      <Cards />
      <Badges />
      <States />
    </div>
  )
}
