import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useKeyboardInset } from '../../lib/useKeyboardInset'
import {
  IconDialog,
  IconSend,
  IconPencil,
  IconCheck,
  IconMaterials,
  type IconProps,
} from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { chat } from '../../lib/gemini'
import { logActivity } from '../../lib/activity'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import type { AppLang, CEFRLevel, ChatTurn } from '../../types'

type Mode = 'chat' | 'writing'

const modes: { id: Mode; label: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { id: 'chat', label: 'Чат', Icon: IconDialog },
  { id: 'writing', label: 'Письмо', Icon: IconPencil },
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

  const level: CEFRLevel = lang === 'es' ? getEsLevel() ?? 'A1' : profileLevel

  return (
    <div className="flex flex-col gap-4">
      {/* как в макете: заголовок + сегмент-переключатель капсулой справа */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">Диалог</h1>
          <p className="text-xs text-[var(--night-text-40)]">
            {lang === 'es' ? `испанский · ${level}` : `уровень ${level}`}
          </p>
        </div>
        <div
          role="group"
          aria-label="Режим"
          className="flex gap-0.5 rounded-full bg-white/[0.07] p-0.5"
        >
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors ${
                mode === m.id
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
              }`}
            >
              <m.Icon size={14} />
              {m.label}
            </button>
          ))}
        </div>
      </header>

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
  const language = lang === 'es' ? 'Spanish' : 'English'
  const levelHint =
    lang === 'es'
      ? level === 'A1' || level === 'A2'
        ? 'Use very simple Spanish: short sentences, present tense mostly, common everyday words.'
        : 'Use natural Spanish with varied tenses and richer vocabulary, but stay clear.'
      : level === 'C1' || level === 'C2'
        ? 'Use rich, natural, idiomatic English and occasionally introduce advanced vocabulary.'
        : level === 'A1' || level === 'A2'
          ? 'Use VERY simple English: sentences of 6-10 words, present tense mostly, only the most common everyday words.'
          : 'Use clear, simple English that matches this level: short sentences, common words.'
  // В ES-режиме в приложении есть настоящие уроки грамматики (вкладка «Грам.»)
  const grammarRef =
    lang === 'es'
      ? 'The app has grammar lessons in the «Учёба» tab (A1-B2: ser/estar, артикли, Presente, Pretérito Indefinido, Imperfecto, Subjuntivo, предлоги и др.). When suggesting a topic, add: "В приложении есть урок на эту тему — открой Учёба → Грамматика, а потом возвращайся потренироваться".'
      : 'The app has English grammar lessons in the «Учёба» tab (A1-C1). When suggesting a topic, add: "В приложении есть урок на эту тему — открой Учёба → Грамматика". You can also give a 3-4 line mini-explanation of the rule in Russian with examples before the exercises.'

  return [
    `You are a friendly ${language} conversation partner AND a patient ${language} teacher in the language-learning app "Recall".`,
    `The learner is a native Russian speaker at CEFR level ${level} in ${language}.`,
    '',
    'EVERY reply has this structure:',
    '',
    `1) Check the learner's LAST message for mistakes. Find ALL of them, not only the main one: grammar, spelling, capitalization, articles, prepositions, word order, unnatural word choice. One line per mistake, exactly:`,
    '[fix] фрагмент с ошибкой → исправление — короткое объяснение по-русски',
    'Count even small mistakes (i → I; go → went; to shop → to the shop; yesterdi → yesterday). Do NOT invent mistakes; informal style is not a mistake. If the message is correct, write exactly one line: [ok] Без ошибок!',
    '',
    `2) Then continue the conversation naturally: 2-4 sentences in ${language} for level ${level}, ending with a question. ${levelHint}`,
    '',
    'TEACHING RULES:',
    '- If several mistakes belong to one grammar topic, or the same mistake repeats across messages, add after the corrections:',
    '[topic] Хромает тема: <название темы по-русски>. Хочешь закрепить? Напиши «давай».',
    grammarRef,
    '- If the learner agrees (давай, да, ok, yes), switch to practice mode: give ONE short exercise at a time (перевод короткой фразы с русского or fill-the-gap), wait for the answer, check it with a one-line explanation, 3-5 exercises total. Then praise the learner and return to the conversation with a new question.',
    '- If the learner asks about grammar or a word, explain in Russian with 2-3 examples before continuing.',
    `- ALL explanations (in Russian) must match a ${level} learner: short, simple everyday words, no linguistic or academic jargon. Explain the way you would to a school student, e.g. chair = «стул — то, на чём сидят», NOT a dictionary-style scientific definition.`,
    '- Plain text only, no markdown formatting. Never skip part 1.',
    '- Service lines MUST start with the EXACT text tags [fix], [ok], [topic] (in square brackets, lowercase). Do NOT use emoji anywhere in your reply.',
  ].join('\n')
}

/**
 * Служебные строки ответа AI помечаются текст-тегом в начале: [fix] —
 * исправление ошибки, [ok] — ошибок нет, [topic] — предложение темы. Тег
 * скрывается, вместо него — иконка и акцентная подсветка. Старые сохранённые
 * сообщения могли начинаться с эмодзи (✏️/✅/📚) — распознаём и их.
 */
const MARKERS = [
  { re: /^(?:✏️|\[fix\])\s*/i, Icon: IconPencil, cls: 'text-[var(--night-accent-text)]' },
  { re: /^(?:✅|\[ok\])\s*/i, Icon: IconCheck, cls: 'text-emerald-400' },
  { re: /^(?:📚|\[topic\])\s*/i, Icon: IconMaterials, cls: 'font-medium text-[var(--night-accent-text)]' },
] as const

function AssistantText({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        const m = MARKERS.find((mk) => mk.re.test(line))
        if (m) {
          const Icon = m.Icon
          return (
            <span key={i} className={m.cls}>
              <Icon size={14} className="mr-1 inline align-[-2px]" />
              {line.replace(m.re, '')}
              {'\n'}
            </span>
          )
        }
        return (
          <span key={i}>
            {line}
            {'\n'}
          </span>
        )
      })}
    </>
  )
}

function ChatSection({ level, lang }: { level: CEFRLevel; lang: AppLang }) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const kb = useKeyboardInset() // высота клавиатуры — панель ввода над ней

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
    // Лента в потоке, ПАНЕЛЬ ВВОДА фиксирована у низа (см. ниже). Внизу большой
    // отступ, чтобы последнее сообщение не пряталось за панелью.
    <div className="flex flex-col gap-3 pb-[calc(11rem+env(safe-area-inset-bottom))]">
      {msgs.length === 0 && (
        <Card>
          <p className="text-[var(--night-text-70)]">
            {lang === 'es'
              ? 'Напиши что-нибудь по-испански — AI ответит просто, поддержит разговор и отдельной строкой поправит ошибки.'
              : 'Напиши что-нибудь по-английски — AI ответит, поддержит разговор и отдельной строкой поправит ошибки.'}
          </p>
          <p className="mt-2 text-sm text-[var(--night-text-40)]">
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
                ? 'self-end rounded-br-md border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.18)] text-[var(--night-text)]'
                : 'self-start rounded-bl-md border border-white/[0.08] bg-[var(--night-surface)] text-[var(--night-text)]'
            }`}
          >
            {m.role === 'assistant' ? <AssistantText content={m.content} /> : m.content}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl rounded-bl-md border border-white/[0.08] bg-[var(--night-surface)] px-4 py-2.5 text-[var(--night-text-40)] dark:border-white/[0.08] dark:bg-[var(--night-surface)]">
            печатает…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Панель ввода прижата к низу. Когда открыта клавиатура (visualViewport
          даёт её высоту kb) — поднимаем панель над ней; иначе панель стоит над
          плавающей навигацией. Так заголовок не уезжает и клавиатура не режет UI. */}
      <div
        className="fixed inset-x-0 z-30 mx-auto max-w-screen-sm border-t border-white/[0.06] bg-[var(--night-bg)] px-4 pb-2 pt-2"
        style={{ bottom: kb > 0 ? kb : 'calc(5.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* поле без рамки + квадратная accent-кнопка отправки */}
        <form onSubmit={send} className="flex items-center gap-2.5">
          <input
            aria-label={lang === 'es' ? 'Сообщение по-испански' : 'Сообщение по-английски'}
            className="h-12 min-w-0 flex-1 rounded-[14px] border-none bg-[var(--night-input)] px-4 text-[15px] outline-none placeholder:text-[var(--night-text-40)] focus:ring-2 focus:ring-[var(--night-accent-45)]"
            placeholder={lang === 'es' ? 'Escribe en español…' : 'Write in English…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            aria-label="Отправить"
            disabled={busy || !input.trim()}
            className="lift flex h-12 w-12 flex-none items-center justify-center rounded-[14px] border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)] text-[var(--night-accent-100)] transition-colors hover:bg-[rgba(145,132,217,.22)] disabled:opacity-40"
          >
            <IconSend size={20} />
          </button>
        </form>

        {msgs.length > 0 && (
          <button
            onClick={reset}
            className="mx-auto mt-1.5 block px-3 py-0.5 text-xs text-[var(--night-text-40)]"
          >
            Новый диалог
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Режим «Письмо» — проверка текста. Результат сохраняется в writing_submissions.
// ---------------------------------------------------------------------------

function writingSystemPrompt(level: CEFRLevel, lang: AppLang): string {
  const subject = lang === 'es' ? 'испанского' : 'английского'
  const textLang = lang === 'es' ? 'испанском' : 'английском'
  // Реальный уровень (для ES — из placement-теста), как в промпте чата:
  // раньше испанский всегда считался A1–A2, и B1/B2-ученику разбор был занижен.
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
