// ============================================================================
// Витрина листа s4: 17 иконок (24 и bolt 48), залитые варианты для вкладок
// на подложке accent-soft и движение — шторка/панель, тост, диалог
// подтверждения, энергия в тексте. Каркас (шапка, вкладки, меню) виден
// вокруг самой витрины.
// ============================================================================
import { useState } from 'react'
import { Bolt } from '../../shared/ui/Bolt'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import * as I from '../../shared/ui/icons'
import { SHEET_BODY, Sheet } from '../../shared/ui/Sheet'
import { SheetHeader } from '../../shared/ui/SheetHeader'
import { UndoToast } from '../../shared/ui/UndoToast'
import { Board } from './ShowcaseS3'

const ICONS = [
  ['home', I.IconHome],
  ['study', I.IconStudy],
  ['practice', I.IconPractice],
  ['dialog', I.IconDialog],
  ['bell', I.IconBell],
  ['check', I.IconCheck],
  ['plus', I.IconPlus],
  ['back', I.IconBack],
  ['calendar', I.IconCalendar],
  ['users', I.IconUsers],
  ['clipboard', I.IconClipboard],
  ['gift', I.IconGift],
  ['clock', I.IconClock],
  ['repeat', I.IconRepeat],
  ['link', I.IconLink],
  ['share', I.IconShare],
  ['bolt', I.IconBolt],
] as const

const FILLS = [
  ['home-fill', I.IconHomeFill],
  ['study-fill', I.IconStudyFill],
  ['practice-fill', I.IconPracticeFill],
  ['dialog-fill', I.IconDialogFill],
  ['calendar-fill', I.IconCalendarFill],
  ['users-fill', I.IconUsersFill],
  ['clipboard-fill', I.IconClipboardFill],
] as const

function Tile({ name, children, fill = false }: { name: string; children: React.ReactNode; fill?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-control px-1 py-3 font-mono text-caption shadow-card ${
        fill ? 'bg-accent-soft text-accent-soft-fg' : 'bg-surface text-fg-secondary'
      }`}
    >
      <span className={`flex items-center ${fill ? '' : 'text-fg'}`}>{children}</span>
      {name}
    </div>
  )
}

export function ShowcaseS4() {
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState(0)
  const { confirm, dialog } = useConfirm()
  const [answer, setAnswer] = useState<string>('')

  return (
    <div className="flex flex-col gap-10" data-sheet="s4">
      <Board title="Иконки · 17" note="Сетка 24, поле 20 × 20, линия 1,75, цвет — currentColor. У вкладок — залитый вариант: вырезы цветом подложки активной вкладки. Энергия — bolt вместо символа ⚡.">
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
          {ICONS.map(([name, Icon]) => (
            <Tile key={name} name={name}>
              <Icon />
            </Tile>
          ))}
          <Tile name="bolt · 48">
            <I.IconBolt size={48} />
          </Tile>
        </div>
        <span className="text-micro font-semibold uppercase text-fg-muted">-fill для вкладок</span>
        <div className="grid grid-cols-4 gap-2.5">
          {FILLS.map(([name, Icon]) => (
            <Tile key={name} name={name} fill>
              <Icon />
            </Tile>
          ))}
        </div>
        <p className="text-body">
          Реплика в «Диалоге» стоит 1 <Bolt />, проверка письма — 2 <Bolt />.
        </p>
      </Board>

      <Board title="Движение" note="Шторка: снизу 320 мс, вниз 240; панель: справа 280, вправо 220; тост 200 / 160; меню и диалог — из кнопки 180 / 140. «Уменьшить движение» — только прозрачность.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSheet(true)} data-demo="sheet">
            Перенести урок
          </Button>
          <Button variant="secondary" onClick={() => setToast((n) => n + 1)} data-demo="toast">
            Показать тост
          </Button>
          <Button
            variant="danger"
            data-demo="confirm"
            onClick={() =>
              void confirm({
                title: 'Отменить урок?',
                body: 'Айгерим получит уведомление. Урок вернётся в остаток.',
                action: 'Отменить урок',
                cancel: 'Не отменять',
              }).then((ok) => setAnswer(ok ? 'отменён' : 'оставлен'))
            }
          >
            Отменить урок
          </Button>
        </div>
        {answer && <p className="text-note text-fg-muted" data-demo="answer">Урок {answer}</p>}
      </Board>

      {sheet && (
        <Sheet onClose={() => setSheet(false)} labelledBy="demo-move">
          <SheetHeader id="demo-move" title="Перенести урок" />
          <div className={SHEET_BODY}>
            <p className="text-body tabular-nums text-fg-secondary">Айгерим · сейчас чт, 15 окт, 19:00–20:00</p>
            <Button size="lg" onClick={() => setSheet(false)}>
              Перенести урок
            </Button>
          </div>
        </Sheet>
      )}
      {toast > 0 && <UndoToast key={toast} text="Урок перенесён" onAction={() => {}} onClose={() => setToast(0)} />}
      {dialog}
    </div>
  )
}
