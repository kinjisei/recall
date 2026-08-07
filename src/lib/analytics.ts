// ============================================================================
// Продуктовая аналитика: свои события в свою таблицу (RPC track_event).
//
// Зачем не внешний сервис: данные и так наши, RLS настроен, никаких лишних
// зависимостей и согласий. Зачем вообще: до этого считались только просмотры
// страниц, и ответить «какой канал привёл платящих» было нечем.
//
// Три правила, которые тут важны:
//  1. Аналитика НИКОГДА не ломает экран: любая ошибка молча проглатывается.
//  2. Визиты пишутся ДО входа (anon_id), иначе у воронки нет знаменателя.
//  3. Источник запоминается ПЕРВЫЙ (first touch) — человек мог прийти из
//     телеграма, а зарегистрироваться через неделю по прямой ссылке.
// ============================================================================
import { supabase } from './supabase'

const ANON_KEY = 'recall.anon_id'
const ATTR_KEY = 'recall.attr'

/** Стабильный идентификатор устройства до входа. */
function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return null // приватный режим — считаем только события после входа
  }
}

/**
 * Откуда пришёл человек. Порядок: явная метка в ссылке → реферер → прямой заход.
 * Сохраняем ОДИН раз: перезапись превратила бы «пришёл из телеграма, вернулся
 * из закладки» в «пришёл из закладки».
 */
export function captureSource(search: string): void {
  try {
    if (localStorage.getItem(ATTR_KEY)) return
    const q = new URLSearchParams(search)
    const utm = q.get('utm_source') ?? q.get('ref') ?? q.get('from')
    let src = utm?.trim()
    if (!src && document.referrer) {
      try {
        const host = new URL(document.referrer).hostname.replace(/^www\./, '')
        // свой же домен рефером не считаем — это внутренний переход
        if (host && host !== location.hostname) src = host
      } catch {
        /* кривой реферер — просто нет источника */
      }
    }
    if (src) localStorage.setItem(ATTR_KEY, src.slice(0, 120))
  } catch {
    /* нет localStorage — источник останется пустым */
  }
}

/** Ответ на вопрос «как узнал» из онбординга — самый честный источник. */
export function setSelfReportedSource(value: string): void {
  try {
    localStorage.setItem(ATTR_KEY, value.slice(0, 120))
  } catch {
    /* не критично */
  }
  void track('how_heard', { value })
}

function storedSource(): string | null {
  try {
    return localStorage.getItem(ATTR_KEY)
  } catch {
    return null
  }
}

/**
 * Отправить событие. Никогда не бросает и никогда не ждёт результата на
 * критическом пути — вызывать без await.
 */
export async function track(name: string, props: Record<string, unknown> = {}): Promise<void> {
  try {
    await supabase.rpc('track_event', {
      p_name: name,
      // props типизированы как Json в схеме; наши значения всегда сериализуемы
      p_props: props as never,
      p_anon: anonId(),
      p_source: storedSource(),
    })
  } catch {
    /* аналитика молчит: потерять событие не страшно, сломать экран — страшно */
  }
}

/** Просмотр экрана. Это и есть знаменатель воронки. */
export function trackPageView(path: string): void {
  void track('page_view', { path })
}
