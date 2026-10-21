// ============================================================================
// Служебные строки ответа AI в «Диалоге»: [fix] — ошибка с исправлением,
// [ok] — «без ошибок», [topic] — хромающая тема (промпт — ConversationPage).
// Старые сохранённые сообщения начинались с эмодзи (✏️/✅/📚) — узнаём и их.
// Один разбор на экран «Диалога» и карточку «Диалог» на «Моей учёбе» (d12):
// у каждой копии регулярок своё мнение о том, что такое поправка. Чистый
// модуль (значки — markerLook.ts): держит test-reply-markers.
// ============================================================================

export type MarkerKind = 'fix' | 'ok' | 'topic'

const MARKERS: { kind: MarkerKind; re: RegExp }[] = [
  { kind: 'fix', re: /^(?:✏️|\[fix\])\s*/i },
  { kind: 'ok', re: /^(?:✅|\[ok\])\s*/i },
  { kind: 'topic', re: /^(?:📚|\[topic\])\s*/i },
]

/** Строка ответа: служебная (вид и текст без метки) или null — обычная реплика. */
export function markerOf(line: string): { kind: MarkerKind; text: string } | null {
  const m = MARKERS.find((mk) => mk.re.test(line))
  return m ? { kind: m.kind, text: line.replace(m.re, '') } : null
}

/** Ответ AI → поправки отдельно, реплика отдельно (карточка «Диалог»: поправка — над репликой). */
export function splitReply(content: string): { notes: { kind: MarkerKind; text: string }[]; text: string } {
  const notes: { kind: MarkerKind; text: string }[] = []
  const rest: string[] = []
  for (const line of content.split('\n')) {
    const m = markerOf(line)
    if (m) notes.push(m)
    else if (line.trim()) rest.push(line)
  }
  return { notes, text: rest.join('\n') }
}
