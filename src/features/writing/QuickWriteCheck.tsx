// ============================================================================
// «Быстрая проверка текста» — свободный текст → разбор AI, без темы и истории.
//
// Раньше жила во вкладке «Диалог» вторым режимом (сегмент Чат/Письмо). По
// решению структуры навигации (docs/nav-structure-options.md, вариант A)
// «Диалог» стал только чатом, а всё письмо собралось в /writing. Здесь — простой
// путь «написал — получил разбор»; рядом в /writing лежат письменные задания по
// теме с критериями экзамена и историей.
//
// Результат сохраняется в writing_submissions — как и прежде: это кормит стрик и
// автозачёт пункта домашки «письмо» (триггер homework_refresh_by_user).
// ============================================================================
import { useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { BackHeader } from '../../shared/ui/BackButton'
import { useAuth } from '../../context/AuthContext'
import { chat } from '../../shared/api/ai'
import { supabase } from '../../shared/api/supabase'
import { logActivity } from '../../lib/activity'
import type { AppLang, CEFRLevel } from '../../types'

function writingSystemPrompt(level: CEFRLevel, lang: AppLang): string {
  const subject = lang === 'es' ? 'испанского' : 'английского'
  const textLang = lang === 'es' ? 'испанском' : 'английском'
  // Реальный уровень (для ES — из placement-теста): раньше испанский всегда
  // считался A1–A2, и B1/B2-ученику разбор был занижен.
  const beginner = level === 'A1' || level === 'A2' ? ' (начинающий)' : ''
  const levelNote = `Ученик — носитель русского, уровень ${level}${beginner}. Он пришлёт текст на ${textLang}.`
  return [
    `Ты — доброжелательный преподаватель ${subject}.`,
    levelNote,
    'Ответь по-русски, без markdown-разметки, строго по разделам:',
    '',
    'Объясняй просто и коротко, под уровень ученика — без научных терминов.',
    '',
    'ОШИБКИ',
    'нумерованный список: «цитата» → исправление — короткое объяснение.',
    'Если ошибок нет — напиши «Ошибок не нашёл».',
    // Не сдвигать время и не выдумывать ошибки (то же правило, что в чате).
    'Не выдумывай ошибки: то, что написано верно, не трогай. Исправляй ошибку ВНУТРИ фразы ученика, не меняя её смысл и время (настоящее остаётся настоящим). Если неверно выбрано САМО время — это ошибка, назови её отдельным пунктом с объяснением.',
    '',
    'УЛУЧШЕННАЯ ВЕРСИЯ',
    `тот же текст на естественном ${textLang} (чуть выше уровня ученика).`,
    // Ревью 2Б: в «улучшенной версии» молча правились ошибки, которых не было в
    // списке (как раз согласование времён — то, что и надо объяснять).
    'Сначала полностью составь список ОШИБКИ, потом пиши улучшенную версию и меняй в ней ТОЛЬКО то, что уже названо в списке. Ничего не исправляй молча: заметил по ходу ещё одну ошибку — вернись и допиши её в список. Правку, которая не ошибка, а стиль, тоже вынеси в список строкой «стиль: было → стало».',
    '',
    'СОВЕТ',
    '1-2 предложения: что подтянуть в первую очередь.',
    '',
    'ОЦЕНКА',
    `одной строкой, например: «уверенный ${level}».`,
  ].join('\n')
}

export function QuickWriteCheck({
  level,
  lang,
  onBack,
}: {
  level: CEFRLevel
  lang: AppLang
  onBack: () => void
}) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    setFeedback(null)
    try {
      const fb = await chat([{ role: 'user', content: body }], {
        system: writingSystemPrompt(level, lang),
        task: 'writing',
      })
      setFeedback(fb)
      void logActivity('writing')
      if (user) {
        // сохраняем в фоне: кнопка не должна ждать записи в базу
        void supabase
          .from('writing_submissions')
          .insert({ user_id: user.id, text: body, feedback: { text: fb, level, lang } })
          .then(({ error: wErr }) => {
            if (wErr) console.warn('Не удалось сохранить проверку:', wErr)
          })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка AI')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
      <BackHeader onBack={onBack} title="Быстрая проверка" label="К письму" />

      <Card>
        <p className="text-[var(--night-text-70)]">
          {lang === 'es'
            ? 'Напиши несколько предложений по-испански — AI разберёт ошибки, предложит улучшенную версию и даст совет.'
            : 'Напиши несколько предложений по-английски — AI разберёт ошибки, предложит улучшенную версию и даст совет.'}
        </p>
      </Card>

      <textarea
        className="min-h-[140px] w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-4 py-3 text-base leading-relaxed outline-none focus:border-[var(--night-accent-45)]"
        placeholder={
          lang === 'es'
            ? 'Hola. Me gusta mucho la música española…'
            : 'Yesterday I go to the shop and buyed some apples…'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
      />

      <Button onClick={check} disabled={busy || !text.trim()}>
        {busy ? 'Проверяю…' : 'Проверить'}
      </Button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {feedback && (
        <Card>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--night-text)]">
            {feedback}
          </p>
          <Button
            variant="ghost"
            className="mt-3 px-3 py-1 text-sm"
            onClick={() => {
              setFeedback(null)
              setText('')
            }}
          >
            Новая проверка
          </Button>
        </Card>
      )}
    </div>
  )
}
