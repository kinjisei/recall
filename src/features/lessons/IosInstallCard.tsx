// ============================================================================
// iPhone в обычной вкладке Safari (макет u3-4): push там нет вовсе — только у
// приложения с экрана «Домой» (iOS 16.4+, архитектура §17). Карточка учит
// добавить Recall за два шага; картинки — схемы панели Safari, а не скриншоты:
// так они не устаревают с каждой версией iOS. «Не сейчас» — переспросим через
// 14 дней (domains/notifications/ask.ts).
// ============================================================================
import type { ReactNode } from 'react'
import { IconPlus, IconShare } from '../../shared/ui/icons'
import { Button } from '../../shared/ui/Button'

function Step({ n, children, picture }: { n: number; children: ReactNode; picture: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-fg">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">{children}</p>
        <div aria-hidden className="mt-2 rounded-xl bg-tint/[0.05] p-2">
          {picture}
        </div>
      </div>
    </li>
  )
}

export function IosInstallCard({ onHide }: { onHide: () => void }) {
  return (
    <section data-ios-install aria-labelledby="ios-install-title" className="animate-fade-up rounded-2xl border border-accent bg-surface p-4 shadow-card">
      <h2 id="ios-install-title" className="text-base font-semibold text-fg">
        Чтобы получать напоминания на iPhone, добавь Recall на экран «Домой»
      </h2>
      <p className="mt-1 text-sm text-fg-secondary">
        На iPhone уведомления приходят только от приложения с экрана «Домой». Это займёт полминуты.
      </p>
      <ol className="mt-4 flex flex-col gap-4">
        <Step
          n={1}
          picture={
            <div className="flex items-center gap-2">
              <span className="h-7 flex-1 rounded-full bg-surface" />
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-accent text-accent-strong">
                <IconShare size={15} />
              </span>
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-accent text-sm font-bold text-accent-strong">•••</span>
            </div>
          }
        >
          Нажми «Поделиться» внизу Safari. В iOS 26 — сначала «•••».
        </Step>
        <Step
          n={2}
          picture={
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="rounded-lg bg-surface px-3 py-2 text-fg-muted">Скопировать</span>
              <span className="flex items-center gap-2 rounded-lg border-2 border-accent bg-surface px-3 py-2 font-semibold text-accent-strong">
                <IconPlus size={15} /> На экран «Домой»
              </span>
            </div>
          }
        >
          Выбери «На экран «Домой»» и нажми «Добавить».
        </Step>
      </ol>
      <p className="mt-4 text-sm text-fg-secondary">Потом открой Recall со значка на экране «Домой» — и включи напоминания.</p>
      <Button variant="ghost" className="mt-2 w-full min-h-11 text-sm" onClick={onHide}>
        Не сейчас
      </Button>
    </section>
  )
}
