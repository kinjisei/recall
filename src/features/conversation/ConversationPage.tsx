import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { chat } from '../../lib/gemini'
import { logActivity } from '../../lib/activity'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import type { AppLang, CEFRLevel, ChatTurn } from '../../types'

type Mode = 'chat' | 'writing'

const modes: { id: Mode; label: string }[] = [
  { id: 'chat', label: '💬 Чат' },
  { id: 'writing', label: '✍️ Письмо' },
]

export function ConversationPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [mode, setMode] = useState<Mode>('chat')
  const [profileLevel, setProfileLevel] = useState<CEFRLevel>('B1')

  // Уровень из профиля — от него зависят промпты (B1 проще, C1 богаче).
  // Профильный уровень описывает английский; испанский пока считаем A1–A2.
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('level')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.level) setProfileLevel(data.level as CEFRLevel)
      })
  }, [user])

  const level: CEFRLevel = lang === 'es' ? 'A1' : profileLevel

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💬 Диалог</h1>
        <span className="text-sm text-slate-400">
          {lang === 'es' ? 'испанский · A1–A2' : `уровень ${level}`}
        </span>
      </header>

      <div className="flex gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === m.id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* key={lang}: при смене языка начинаем чат/проверку заново */}
      {mode === 'chat' ? (
        <ChatSection key={lang} level={level} lang={lang} />
      ) : (
        <WritingSection key={lang} level={level} lang={lang} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Режим «Чат» — AI-собеседник. Переписка сохраняется в conversations/messages.
// ---------------------------------------------------------------------------

function chatSystemPrompt(level: CEFRLevel, lang: AppLang): string {
  if (lang === 'es') {
    return [
      'You are a friendly Spanish conversation partner in the language-learning app "Recall".',
      'The learner is a native Russian speaker and a BEGINNER in Spanish (CEFR A1-A2).',
      'Use very simple Spanish: short sentences, present tense mostly, common everyday words.',
      'Keep every reply short: 2-3 sentences, and end with a simple question to keep the conversation going.',
      'If the learner makes a noticeable mistake, start your reply with a separate line like:',
      '✏️ corrected phrase — короткое объяснение ошибки по-русски',
      'and then continue the conversation normally.',
      'If the learner asks to explain something, explain in Russian.',
      'Plain text only, no markdown formatting.',
    ].join(' ')
  }
  const levelHint =
    level === 'C1' || level === 'C2'
      ? 'Use rich, natural, idiomatic English and occasionally introduce advanced vocabulary.'
      : 'Use clear, simple English that matches this level: short sentences, common words.'
  return [
    'You are a friendly English conversation partner in the language-learning app "Recall".',
    `The learner is a native Russian speaker at CEFR level ${level}.`,
    levelHint,
    'Keep every reply short: 2-4 sentences, and end with a question to keep the conversation going.',
    'If the learner makes a noticeable mistake, start your reply with a separate line like:',
    '✏️ corrected phrase — короткое объяснение ошибки по-русски',
    'and then continue the conversation normally.',
    'If the learner asks to explain something, explain in Russian.',
    'Plain text only, no markdown formatting.',
  ].join(' ')
}

function ChatSection({ level, lang }: { level: CEFRLevel; lang: AppLang }) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  // Сохраняем реплики в БД; сбой сохранения не должен ломать сам чат.
  const persist = async (turns: ChatTurn[]) => {
    if (!user) return
    try {
      if (!convIdRef.current) {
        const { data, error: cErr } = await supabase
          .from('conversations')
          .insert({ user_id: user.id })
          .select('id')
          .single()
        if (cErr) throw cErr
        convIdRef.current = data.id as string
      }
      const rows = turns.map((t) => ({
        conversation_id: convIdRef.current,
        role: t.role,
        content: t.content,
      }))
      const { error: mErr } = await supabase.from('messages').insert(rows)
      if (mErr) throw mErr
    } catch (e) {
      console.warn('Не удалось сохранить переписку:', e)
    }
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setError(null)
    setInput('')
    const history: ChatTurn[] = [...msgs, { role: 'user', content: text }]
    setMsgs(history)
    setBusy(true)
    try {
      // отправляем только последние 20 реплик — экономим бесплатные токены
      const reply = await chat(history.slice(-20), {
        system: chatSystemPrompt(level, lang),
      })
      setMsgs([...history, { role: 'assistant', content: reply }])
      void logActivity('conversation')
      void persist([
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ])
    } catch (err) {
      // возвращаем текст в поле ввода, чтобы не потерять написанное
      setError(err instanceof Error ? err.message : 'Ошибка AI')
      setMsgs(msgs)
      setInput(text)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setMsgs([])
    setError(null)
    convIdRef.current = null
  }

  return (
    <div className="flex flex-col gap-3">
      {msgs.length === 0 && (
        <Card>
          <p className="text-slate-600 dark:text-slate-300">
            {lang === 'es'
              ? 'Напиши что-нибудь по-испански — AI ответит просто, поддержит разговор и поправит ошибки (строкой с ✏️).'
              : 'Напиши что-нибудь по-английски — AI ответит, поддержит разговор и поправит ошибки (строкой с ✏️).'}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {lang === 'es'
              ? 'Например: «¡Hola! Me llamo Iván. ¿Cómo estás?»'
              : 'Например: «Hi! I want to talk about travelling.»'}
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              m.role === 'user'
                ? 'self-end rounded-br-md bg-sky-600 text-white'
                : 'self-start rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
            печатает…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900"
          placeholder={lang === 'es' ? 'Escribe en español…' : 'Write in English…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          ➤
        </Button>
      </form>

      {msgs.length > 0 && (
        <Button variant="ghost" className="self-center px-3 py-1 text-sm" onClick={reset}>
          Новый диалог
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Режим «Письмо» — проверка текста. Результат сохраняется в writing_submissions.
// ---------------------------------------------------------------------------

function writingSystemPrompt(level: CEFRLevel, lang: AppLang): string {
  const subject = lang === 'es' ? 'испанского' : 'английского'
  const textLang = lang === 'es' ? 'испанском' : 'английском'
  const levelNote =
    lang === 'es'
      ? 'Ученик — носитель русского, начинающий (A1–A2). Он пришлёт текст на испанском.'
      : `Ученик — носитель русского, уровень ${level}. Он пришлёт текст на английском.`
  return [
    `Ты — доброжелательный преподаватель ${subject}.`,
    levelNote,
    'Ответь по-русски, без markdown-разметки, строго по разделам:',
    '',
    'ОШИБКИ',
    'нумерованный список: «цитата» → исправление — короткое объяснение.',
    'Если ошибок нет — напиши «Ошибок не нашёл 🎉».',
    '',
    'УЛУЧШЕННАЯ ВЕРСИЯ',
    `тот же текст на естественном ${textLang} (чуть выше уровня ученика).`,
    '',
    'СОВЕТ',
    '1-2 предложения: что подтянуть в первую очередь.',
    '',
    'ОЦЕНКА',
    `одной строкой, например: «уверенный ${level}».`,
  ].join('\n')
}

function WritingSection({ level, lang }: { level: CEFRLevel; lang: AppLang }) {
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
    <div className="flex flex-col gap-3">
      <Card>
        <p className="text-slate-600 dark:text-slate-300">
          {lang === 'es'
            ? 'Напиши несколько предложений по-испански — AI разберёт ошибки, предложит улучшенную версию и даст совет.'
            : 'Напиши несколько предложений по-английски — AI разберёт ошибки, предложит улучшенную версию и даст совет.'}
        </p>
      </Card>

      <textarea
        className="min-h-[140px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900"
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
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">
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
