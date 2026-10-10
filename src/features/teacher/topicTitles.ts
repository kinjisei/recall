// ============================================================================
// Названия грамматических тем для карточки ученика: диагностика, плашка
// «Слабая тема» (макет t6-2) и отчёт родителям называют тему словами, а в
// базе — только номер (grammar_mistakes.topic_id). Данные уроков ленивые:
// грузим только языки, в которых у ученика есть ошибки.
// ============================================================================
import { useEffect, useState } from 'react'
import type { StudentDiagnostics } from '../../lib/diagnostics'
import type { AppLang, GrammarTopic } from '../../types'

/** lang:topicId → название урока и уровень. */
export type TopicTitles = Map<string, { title: string; level: string }>

async function loadTopicTitles(langs: AppLang[]): Promise<TopicTitles> {
  const map: TopicTitles = new Map()
  for (const lang of langs) {
    const mod = lang === 'es' ? await import('../../data/spanish/grammar') : await import('../../data/english/grammar')
    for (const t of mod.grammarTopics as GrammarTopic[]) map.set(`${lang}:${t.id}`, { title: t.title, level: t.level })
  }
  return map
}

/** Названия тем, в которых ученик ошибается; пока грузятся — пустая карта. */
export function useTopicTitles(diag: StudentDiagnostics | null): TopicTitles {
  const [titles, setTitles] = useState<TopicTitles>(new Map())
  const langs = diag ? [...new Set(diag.mistakes.map((m) => m.lang))].sort().join(',') : ''
  useEffect(() => {
    if (!langs) return
    let alive = true
    // не загрузилось — темы назовутся номером: карточка из-за этого не падает
    loadTopicTitles(langs.split(',') as AppLang[]).then((m) => alive && setTitles(m), () => {})
    return () => {
      alive = false
    }
  }, [langs])
  return titles
}

/** «Present Perfect»; нет названия — «тема №12». */
export function topicTitle(titles: TopicTitles, lang: string, topicId: number): string {
  return titles.get(`${lang}:${topicId}`)?.title ?? `тема №${topicId}`
}
