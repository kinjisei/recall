// ============================================================================
// Банк ошибок грамматики: упражнения, где пользователь ошибся, копятся в
// localStorage и доступны повторным раундом «Мои ошибки» на экране грамматики.
// Верный ответ (в обычном уроке или в повторе) убирает упражнение из банка.
//
// Синк в БД (2026-07-22): localStorage остаётся источником правды для самого
// ученика (быстро, офлайн), но каждая запись/удаление тихо дублируется в
// таблицу grammar_mistakes — чтобы ПРЕПОДАВАТЕЛЬ видел буксующие темы в
// диагностической карте ученицы. Сбои сети глотаем: банк не должен ломать урок.
// ============================================================================
import { supabase } from './supabase'
import type { AppLang } from '../types'

export interface GrammarMistake {
  topicId: number
  /** Индекс упражнения внутри темы. */
  ex: number
}

const key = (lang: AppLang) => `recall.grammar_mistakes.${lang}`

export function getMistakes(lang: AppLang): GrammarMistake[] {
  try {
    const raw = localStorage.getItem(key(lang))
    const list = raw ? (JSON.parse(raw) as GrammarMistake[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(lang: AppLang, list: GrammarMistake[]): void {
  try {
    localStorage.setItem(key(lang), JSON.stringify(list))
  } catch {
    /* приватный режим и т.п. — банк просто не сохранится */
  }
}

/** id текущего пользователя (null, если сессии нет — синк просто пропускается). */
async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

async function dbAdd(lang: AppLang, rows: GrammarMistake[]): Promise<void> {
  const id = await uid()
  if (!id || rows.length === 0) return
  await supabase.from('grammar_mistakes').upsert(
    rows.map((m) => ({ user_id: id, lang, topic_id: m.topicId, ex: m.ex })),
    { onConflict: 'user_id,lang,topic_id,ex', ignoreDuplicates: true },
  )
}

export function addMistake(lang: AppLang, m: GrammarMistake): void {
  const list = getMistakes(lang)
  if (list.some((x) => x.topicId === m.topicId && x.ex === m.ex)) return
  save(lang, [...list, m])
  dbAdd(lang, [m]).catch(() => {})
}

export function removeMistake(lang: AppLang, m: GrammarMistake): void {
  save(
    lang,
    getMistakes(lang).filter((x) => !(x.topicId === m.topicId && x.ex === m.ex)),
  )
  // RLS сама ограничит удаление своими строками — user_id в фильтре не нужен
  void supabase
    .from('grammar_mistakes')
    .delete()
    .match({ lang, topic_id: m.topicId, ex: m.ex })
    .then(
      () => {},
      () => {},
    )
}

/**
 * Разовая заливка накопленного ДО синка localStorage-банка в БД, чтобы у
 * преподавателя сразу была история, а не пустая карта. Идемпотентно
 * (upsert + флаг в localStorage); зовётся при открытии грамматики.
 */
export function syncMistakesToDb(lang: AppLang): void {
  const flag = `recall.mistakes_synced.${lang}`
  try {
    if (localStorage.getItem(flag)) return
  } catch {
    return
  }
  dbAdd(lang, getMistakes(lang))
    .then(() => {
      try {
        localStorage.setItem(flag, '1')
      } catch {
        /* некритично */
      }
    })
    .catch(() => {})
}
