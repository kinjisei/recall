// ============================================================================
// «Поделиться» (журнал п.23; архитектура §17): сообщение уходит СО СВОЕГО
// номера человека и по его нажатию — это ручное сообщение, не рассылка, бана
// за него нет. Сервер не нужен: ссылка открывает WhatsApp или Telegram с
// готовым текстом, отправляет сам человек.
//   wa.me/<номер>?text=…          faq.whatsapp.com/5913398998672934
//   t.me/share/url?url=…&text=…   core.telegram.org/widgets/share
//   navigator.share               системное «Поделиться» (нужно нажатие)
// Где понадобится: «Напомнить об оплате» (Ф2.8), переслать напоминание об
// уроке ученику без приложения (журнал п.38, 42).
//
// ⚠️ Текст кодируется encodeURIComponent, а не URLSearchParams: тот пишет
// пробел как «+», и часть клиентов показывает человеку плюсы вместо пробелов.
// ============================================================================

/**
 * Номер для wa.me: только цифры, в международном виде, без «+».
 * Казахстан и Россия (+7): «8 701 …» и «701 …» (десять цифр) → «7701…».
 * Непонятный номер — null: ссылка откроет WhatsApp с выбором контакта.
 */
export function waPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return '7' + d
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) return '7' + d.slice(1)
  if (d.length >= 11 && d.length <= 15) return d
  return null
}

/** «Написать в WhatsApp» с готовым текстом; без номера — выбор контакта. */
export function whatsappLink(text: string, phone?: string | null): string {
  const p = phone ? waPhone(phone) : null
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`
}

/**
 * «Переслать в Telegram»: получателя человек выбирает сам. url — ссылка в
 * сообщении, у Telegram она обязательна (например, адрес Recall).
 */
export function telegramLink(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
}

/**
 * Системное «Поделиться» (на телефоне — список приложений). Звать только из
 * обработчика нажатия: без жеста браузер откажет.
 */
export async function shareNative(text: string, url?: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  if (!nav || typeof nav.share !== 'function') return 'unsupported'
  try {
    await nav.share(url ? { text, url } : { text })
    return 'shared'
  } catch (e) {
    // закрыл окно сам — это не ошибка; остальное (нет прав, не тот жест) —
    // предложить ссылки WhatsApp / Telegram
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'unsupported'
  }
}
