// ============================================================================
// «Что-то не работает или непонятно?» в Настройках (макет d14, в оглавлении —
// «Помощь»): «Оставить отзыв», связь с нами (WhatsApp · Telegram · Почта —
// общий ContactLinks) и под чертой — условия, политика, тарифы.
//
// До этого из приложения написать было НЕКУДА: адрес лежал только в
// юридических страницах. Отзыв — отдельно от письма: письмо пишут, когда
// что-то сломалось, а «чего не хватает» так никто не расскажет — порог в
// один тап.
// ============================================================================
import { useState } from 'react'
import { FeedbackSheet } from '../../components/FeedbackSheet'
import { SUPPORT_SLA } from '../../shared/lib/contacts'
import { AppLink } from '../../shared/ui/AppLink'
import { Button } from '../../shared/ui/Button'
import { ContactLinks } from '../../shared/ui/ContactLinks'
import { SettingsCard } from './settingsBits'

export function HelpSection() {
  const [feedback, setFeedback] = useState(false)
  // Link, не <a>: обычная ссылка перезагружает всё приложение и рвёт историю
  const link = 'flex min-h-11 items-center text-sm font-medium text-accent-strong'
  return (
    // строка «когда ответим» — сверх кадра d14: срок ответа человеку важнее места
    <SettingsCard id="help" title="Что-то не работает или непонятно?" toc="Помощь" note={`Напиши нам — починим или объясним. ${SUPPORT_SLA}.`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setFeedback(true)}>
          Оставить отзыв
        </Button>
        <ContactLinks inline />
      </div>
      <div className="flex flex-wrap gap-x-4.5 border-t border-line pt-1">
        <AppLink to="/terms" className={link}>
          Условия использования
        </AppLink>
        <AppLink to="/privacy" className={link}>
          Политика конфиденциальности
        </AppLink>
        <AppLink to="/pricing" className={link}>
          Тарифы
        </AppLink>
      </div>
      {feedback && <FeedbackSheet where="settings" onClose={() => setFeedback(false)} />}
    </SettingsCard>
  )
}
