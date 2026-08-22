import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useKeyboardInset } from '../../lib/useKeyboardInset'
import { useChatList } from '../../lib/useChatList'
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
import { TabPicker } from '../../components/TabPicker'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../../lib/profile'
import { chat, chatStream, isNetworkError } from '../../lib/gemini'
import { aiOverloaded, clearAiFailures, recordAiServerFailure } from '../../lib/aiHealth'
import { logActivity } from '../../lib/activity'
import { useAuth } from '../../context/AuthContext'
import { loadLastChat, startNewChat } from '../../lib/chatHistory'
import { Loading } from '../../components/Loading'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import type { AppLang, CEFRLevel, ChatTurn, LearningGoal } from '../../types'
import { Thinking } from '../../components/Thinking'

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
  // цель обучения из профиля — уходит в промпт (см. goalHint)
  const [goal, setGoal] = useState<LearningGoal | null>(null)
  const [profileKnown, setProfileKnown] = useState(false)

  // Уровень из профиля — от него зависят промпты (B1 проще, C1 богаче).
  // Профильный уровень описывает английский; испанский пока считаем A1–A2.
  useEffect(() => {
    if (!user) return
    // кэш профиля — без лишнего запроса при каждом заходе во вкладку
    getProfile(user.id).then((p) => {
      if (p?.level) {
        setProfileLevel(p.level as CEFRLevel)
        setProfileKnown(true)
      }
      setGoal(p?.goal ?? null)
    })
  }, [user])

  const level: CEFRLevel = lang === 'es' ? getEsLevel() ?? 'A1' : profileLevel
  // знаем ли уровень на самом деле (профиль мог быть пустым)
  const knownLevel = lang === 'es' ? getEsLevel() !== null : profileKnown

  return (
    <div className="flex flex-col gap-4">
      {/* как в макете: заголовок + сегмент-переключатель капсулой справа */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight">Диалог</h1>
          <p className="text-xs text-[var(--night-text-40)]">
            {/* Уровень показываем, только если он ИЗВЕСТЕН: у нового аккаунта
                его нет, а B1 здесь — рабочее умолчание для промпта, не факт
                о человеке. Раньше экран уверенно писал «уровень B1». */}
            {lang === 'es'
              ? `испанский · ${level}`
              : knownLevel
                ? `уровень ${level}`
                : 'уровень определим по ходу'}
          </p>
        </div>
        <TabPicker variant="segment" options={modes} value={mode} onChange={setMode} ariaLabel="Режим" />
      </header>

      {/* key={lang}: при смене языка начинаем чат/проверку заново */}
      {mode === 'chat' ? (
        <ChatSection key={lang} level={level} lang={lang} goal={goal} />
      ) : (
        <WritingSection key={lang} level={level} lang={lang} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Режим «Чат» — AI-собеседник. Переписка сохраняется в conversations/messages.
// ---------------------------------------------------------------------------

/** Подсказка AI о том, ЗАЧЕМ человек учит язык. Без неё разговор одинаков и
 *  для школьника, и для готовящегося к IELTS — а это разные занятия. */
function goalHint(goal: LearningGoal | null): string {
  switch (goal) {
    case 'exam':
      return 'The learner is preparing for an English exam (IELTS/TOEFL). Favour exam-style topics and academic phrasing, and point out where a phrase would be too informal for the exam.'
    case 'school':
      return 'The learner studies at school or university. Keep topics close to school subjects and homework, and explain rules the way a teacher would.'
    case 'work':
      return 'The learner needs the language for work. Favour workplace situations: meetings, email, small talk with colleagues, polite requests.'
    case 'travel':
      return 'The learner needs the language for travel and living abroad. Favour practical situations: transport, renting, doctor, shops, paperwork.'
    case 'self':
      return 'The learner studies for personal interest. Keep it relaxed and follow whatever topics they enjoy.'
    default:
      return ''
  }
}

function chatSystemPrompt(level: CEFRLevel, lang: AppLang, goal: LearningGoal | null): string {
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
    goalHint(goal),
    '',
    'EVERY reply has this structure:',
    '',
    `1) Check the learner's LAST message for mistakes. Find ALL of them, not only the main one: grammar, spelling, capitalization, articles, prepositions, word order, unnatural word choice. One line per mistake, exactly:`,
    '[fix] фрагмент с ошибкой → исправление — короткое объяснение по-русски',
    'Count even small mistakes (i → I; go → went; to shop → to the shop; yesterdi → yesterday). Do NOT invent mistakes; informal style is not a mistake. If the message is correct, write exactly one line: [ok] Без ошибок!',
    // Ошибка В ИСПРАВЛЕНИИ опаснее пропущенной: новичок не может её перепроверить.
    // Два правила ниже — против двух реальных промахов из ревью 2Б: «he don't like»
    // правилось на «he didn't like» (сдвиг времени), а верное «too» вычёркивалось.
    'NEVER change the tense, the time frame or the meaning of what the learner wrote: fix the mistake INSIDE their own sentence. A present-tense sentence stays present: "he don\'t like it" → "he doesn\'t like it", NEVER "he didn\'t like it"; "I am agree" → "I agree", NEVER "I agreed". If both a present and a past version are possible, show both: "he don\'t → he doesn\'t / he didn\'t (сейчас / в прошлом)".',
    'Before writing a [fix] line, check: is this fragment really WRONG in English? Leave alone anything that is already correct, even if you would have phrased the thought differently — e.g. "My sister works in a school too" is fully correct and "too" must NOT be removed. If you are not sure what the learner meant, do NOT correct it: ask a short question in Russian instead.',
    '',
    `2) Then continue the conversation naturally: 2-4 sentences in ${language} for level ${level}, ending with a question. ${levelHint}`,
    '',
    'TEACHING RULES:',
    '- If several mistakes belong to one grammar topic, or the same mistake repeats across messages, add after the corrections:',
    '[topic] Хромает тема: <название темы по-русски>. Хочешь закрепить? Напиши «давай».',
    grammarRef,
    '- If the learner agrees (давай, да, ok, yes), switch to practice mode: give ONE short exercise at a time (перевод короткой фразы с русского or fill-the-gap), wait for the answer, check it with a one-line explanation, 3-5 exercises total. Then praise the learner and return to the conversation with a new question.',
    '- If the learner asks about grammar or a word, explain in Russian with 2-3 examples before continuing.',
    `- ALL explanations (in Russian) must match a ${level} learner: short, simple everyday words, no linguistic or academic jargon. Explain the way you would to a school student, e.g. chair = «стул — то, на чём сидят», NOT a dictionary-style scientific definition. In Russian always address the learner as «ты» (never «вы») — the whole app speaks «ты».`,
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

function ChatSection({
  level,
  lang,
  goal,
}: {
  level: CEFRLevel
  lang: AppLang
  goal: LearningGoal | null
}) {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // Пошёл поток ответа: «печатает» сменяется растущей репликой. busy при этом
  // остаётся true — второе сообщение отправить нельзя, пока ответ не дописан.
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Серия серверных сбоёв AI (3 за час): показываем честное «это на нашей
  // стороне», а не даём молча биться дальше. Сетевые сбои сюда не идут.
  const [overloaded, setOverloaded] = useState(aiOverloaded())
  // пока история поднимается — не показываем «пустой чат», иначе на секунду
  // мигает приглашение начать разговор, который на самом деле уже идёт
  const [loadingHistory, setLoadingHistory] = useState(true)
  const convIdRef = useRef<string | null>(null)
  const kb = useKeyboardInset() // высота клавиатуры — панель ввода над ней
  // лента скроллится ВНУТРИ себя (мессенджер-паттерн): шапка всегда видна,
  // клавиатура сжимает список, новые сообщения показывают низ ленты
  const { listRef, height } = useChatList(kb, [msgs, busy])

  // Поднимаем прошлую переписку этого языка. Раньше реплики писались в базу и
  // НИКОГДА не читались: уход за словом или уроком обнулял чат.
  useEffect(() => {
    if (!user) return
    let alive = true
    setLoadingHistory(true)
    setMsgs([])
    convIdRef.current = null
    loadLastChat(user.id, lang)
      .then((prev) => {
        if (!alive || !prev) return
        convIdRef.current = prev.id
        setMsgs(prev.turns)
      })
      .finally(() => alive && setLoadingHistory(false))
    return () => {
      alive = false
    }
  }, [user?.id, lang])

  // Сохраняем реплики в БД; сбой сохранения не должен ломать сам чат.
  //
  // ⚠️ Время у каждой реплики СВОЁ и проставляется явно. Раньше обе строки
  // уходили одним insert-ом с created_at = now(), а now() в Postgres — время
  // ТРАНЗАКЦИИ, то есть одинаковое для обеих. При загрузке сортировка по
  // времени становилась произвольной, и переписка открывалась вывернутой:
  // сначала ответ AI, под ним вопрос, на который он отвечает.
  const persist = async (turns: { role: ChatTurn['role']; content: string; at: Date }[]) => {
    if (!user) return
    try {
      if (!convIdRef.current) {
        const id = await startNewChat(user.id, lang)
        if (!id) throw new Error('не удалось создать переписку')
        convIdRef.current = id
      }
      const rows = turns.map((t) => ({
        conversation_id: convIdRef.current,
        role: t.role,
        content: t.content,
        created_at: t.at.toISOString(),
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
    const askedAt = new Date()
    const history: ChatTurn[] = [...msgs, { role: 'user', content: text }]
    setMsgs(history)
    setBusy(true)
    setStreaming(false)
    try {
      // отправляем только последние 20 реплик — экономим бесплатные токены.
      // Ответ приходит ПОТОКОМ: реплика ассистента растёт на глазах.
      let acc = ''
      let started = false
      const reply = await chatStream(
        history.slice(-20),
        { system: chatSystemPrompt(level, lang, goal), task: 'dialog' },
        (delta) => {
          acc += delta
          if (!started) {
            started = true
            setStreaming(true) // первый кусок — прячем «печатает»
          }
          setMsgs([...history, { role: 'assistant', content: acc }])
        },
      )
      // на случай, если поток был пустой по кускам, но текст вернулся
      setMsgs([...history, { role: 'assistant', content: reply }])
      clearAiFailures() // ответ пришёл — серия сбоёв прервана
      setOverloaded(false)
      void logActivity('conversation')
      void persist([
        { role: 'user', content: text, at: askedAt },
        { role: 'assistant', content: reply, at: new Date() },
      ])
    } catch (err) {
      // возвращаем текст в поле ввода, чтобы не потерять написанное
      setError(err instanceof Error ? err.message : 'Ошибка AI')
      setMsgs(msgs)
      setInput(text)
      // Серверный сбой считаем; сетевой (нет интернета) — нет, у него своё
      // сообщение и это не повод винить сервер.
      if (!isNetworkError(err)) {
        recordAiServerFailure()
        if (aiOverloaded()) setOverloaded(true)
      }
    } finally {
      setBusy(false)
      setStreaming(false)
    }
  }

  const reset = () => {
    setMsgs([])
    setError(null)
    convIdRef.current = null
    // Заводим новую переписку сразу, а не при первой реплике: иначе выход и
    // возврат поднимали бы прежнюю — ту самую, с которой только что попрощались.
    if (user) {
      void startNewChat(user.id, lang).then((id) => {
        if (id) convIdRef.current = id
      })
    }
  }

  return (
    // Лента — внутренний скролл фиксированной высоты, панель ввода прижата к
    // низу. Страница НЕ скроллится: шапка приложения остаётся на месте.
    <div className="flex flex-col gap-3">
      <div
        ref={listRef}
        style={height ? { height } : undefined}
        className="flex flex-col gap-3 overflow-y-auto overscroll-contain"
      >
      {/* пока поднимаем прошлую переписку — не мигаем приглашением начать
          разговор, который на самом деле уже идёт */}
      {loadingHistory && msgs.length === 0 && <Loading label="Открываем диалог" />}
      {!loadingHistory && msgs.length === 0 && (
        <Card className="flex-none">
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
        {busy && !streaming && (
          <div className="self-start rounded-2xl rounded-bl-md border border-white/[0.08] bg-[var(--night-surface)] px-4 py-2.5 text-[var(--night-text-40)]">
            <Thinking label="печатает" />
          </div>
        )}
      </div>

      {overloaded ? (
        // Серия серверных сбоёв: честно говорим, что это на нашей стороне, и не
        // винимо человека. Кнопка отправки остаётся — это осознанная новая
        // попытка, а не молчаливое долбление; удачный ответ снимет баннер.
        <p className="flex-none text-sm text-amber-300">
          Похоже, у AI сейчас неполадки на нашей стороне — это не из-за тебя. Попробуй позже.
          Слова, чтение, грамматика и произношение работают как обычно.
        </p>
      ) : (
        error && <p className="flex-none text-sm text-red-500">{error}</p>
      )}
      </div>

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
    // То же правило, что в промпте чата: не сдвигать время и не выдумывать ошибки.
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
