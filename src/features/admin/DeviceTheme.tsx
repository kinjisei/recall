// Тема этого устройства — только владельцу, пока светлая тема черновая
// (решение владельца 28.09.2026; журнал п.37). У остальных тема всегда тёмная:
// выбор хранится на устройстве, а переключатель есть только здесь.
import { ThemePicker } from '../../shared/ui/ThemePicker'

export function DeviceTheme() {
  return (
    <section className="rounded-2xl border border-tint/[0.08] bg-surface p-4">
      <h2 className="text-sm font-medium">Тема на этом устройстве</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Светлая — черновик до редизайна: старые экраны местами красятся мимо токенов. Меняется
        только у тебя и только здесь; остальные всегда видят тёмную.
      </p>
      <div className="mt-3">
        <ThemePicker />
      </div>
    </section>
  )
}
