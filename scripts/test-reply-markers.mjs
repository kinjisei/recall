/**
 * Служебные строки ответа AI в «Диалоге» (src/features/conversation/
 * replyMarkers.ts; PLAN.md Ф2.17-4г-1): один разбор на ленту «Диалога» и
 * карточку «Диалог» на «Моей учёбе» (d12).
 *
 * Держит:
 *   1. [fix], [ok], [topic] — в любом регистре; старые эмодзи ✏️ ✅ 📚;
 *   2. метка снята с текста; обычная строка — не служебная;
 *   3. splitReply: поправки отдельно, реплика — остальные строки без пустых.
 *
 * ⚠️ Ожидания — литералами.
 *
 * Запуск: node scripts/test-reply-markers.mjs
 */
import { markerOf, splitReply } from '../src/features/conversation/replyMarkers.ts'

let pass = 0
let fail = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`}`)
}

check('[fix]', markerOf('[fix] i go → I went — прошедшее'), { kind: 'fix', text: 'i go → I went — прошедшее' })
check('[OK] в верхнем регистре', markerOf('[OK] Без ошибок!'), { kind: 'ok', text: 'Без ошибок!' })
check('[topic]', markerOf('[topic] Хромает тема: артикли'), { kind: 'topic', text: 'Хромает тема: артикли' })
check('старые эмодзи ✏️ ✅ 📚', ['✏️ a', '✅ b', '📚 c'].map((l) => markerOf(l)?.kind), ['fix', 'ok', 'topic'])
check('обычная реплика — не служебная', markerOf('¡Qué bien! ¿Y qué compraron?'), null)
check('метка не в начале — не служебная', markerOf('Скажи [ok], если понятно'), null)
check(
  'splitReply: поправка над репликой, пустые строки выброшены',
  splitReply('[ok] Верно! «yo» можно опустить\n\n¡Qué bien!\n¿Y qué compraron?'),
  { notes: [{ kind: 'ok', text: 'Верно! «yo» можно опустить' }], text: '¡Qué bien!\n¿Y qué compraron?' },
)
check('splitReply: две поправки и тема', splitReply('[fix] a → b — x\n[fix] c → d — y\n[topic] Тема\nNext?').notes.map((n) => n.kind), ['fix', 'fix', 'topic'])
check('splitReply: без меток — вся реплика', splitReply('Hi!\nHow are you?'), { notes: [], text: 'Hi!\nHow are you?' })

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
