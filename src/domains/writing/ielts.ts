// ============================================================================
// Шкала экзаменатора IELTS Writing — сжатый пересказ официальных band
// descriptors (public version, updated May 2023: ielts.org/cdn/ielts-guides/
// ielts-writing-band-descriptors.pdf) и Key Assessment Criteria. Её читает
// модель, а ограничивающие признаки (`IELTS_LIMITS`) применяет наш код
// (`examiner.ts`), журнал п.77.
//
// Главное правило шкалы, ради которого всё это: «A script must fully fit the
// positive features of the descriptor at a particular level» — ступень
// критерия = высшая, ВСЕМ признакам которой работа соответствует полностью.
// «Bolded text indicates negative features that will limit a rating» — эти
// признаки здесь помечены ⛔ и стоят в `IELTS_LIMITS` с потолком.
// ============================================================================

export type IeltsKind = 'task2' | 'academic1' | 'gt1'
export type CritKey = 'task' | 'coherence' | 'lexis' | 'grammar'

/** Порядок критериев — как на экране (чипы «Task · Cohesion · Lexis · Grammar»). */
export const CRITERIA: readonly { key: CritKey; label: string }[] = [
  { key: 'task', label: 'Task' },
  { key: 'coherence', label: 'Cohesion' },
  { key: 'lexis', label: 'Lexis' },
  { key: 'grammar', label: 'Grammar' },
]

/** Минимум слов по заданию (Key Assessment Criteria). */
export const MIN_WORDS: Record<IeltsKind, number> = { task2: 250, academic1: 150, gt1: 150 }

type Scale = Record<number, string>

const TASK_RESPONSE: Scale = {
  9: 'The prompt is appropriately addressed and explored in depth. A clear and fully developed position directly answers the question(s). Ideas are relevant, fully extended and well supported. Lapses in content or support are extremely rare.',
  8: 'The prompt is appropriately and sufficiently addressed. A clear and well-developed position. Ideas are relevant, well extended and supported. Occasional omissions or lapses in content.',
  7: 'The main parts of the prompt are appropriately addressed. A clear and developed position. Main ideas are extended and supported, but there may be over-generalisation or a lack of focus and precision in supporting ideas.',
  6: 'The main parts of the prompt are addressed (some more fully than others); appropriate format. A position directly relevant to the prompt, although conclusions may be unclear, unjustified or repetitive. Main ideas are relevant, but some are insufficiently developed or unclear; some support is less relevant or inadequate.',
  5: '⛔ The main parts of the prompt are incompletely addressed [limit: incomplete]. The format may be inappropriate in places. A position is expressed, but its development is not always clear. Some main ideas, but limited and not sufficiently developed, and/or irrelevant detail; some repetition.',
  4: 'The prompt is tackled in a minimal way, or the answer is tangential [limit: tangential]. ⛔ The format may be inappropriate. A position is discernible, but the reader has to read carefully to find it. Main ideas are difficult to identify and may lack relevance, clarity or support. Large parts may be repetitive.',
  3: 'No part of the prompt is adequately addressed, or the prompt is misunderstood. No relevant position can be identified. Few ideas, largely undeveloped or irrelevant.',
  2: 'The content is barely related to the prompt. No position. ⛔ The entire response may be off-topic [limit: off_topic].',
}

const TASK_ACADEMIC1: Scale = {
  9: 'All requirements of the task are fully and appropriately satisfied; extremely rare lapses in content.',
  8: 'Covers all requirements appropriately, relevantly and sufficiently. Key features are skilfully selected, clearly presented, highlighted and illustrated. Occasional omissions or lapses.',
  7: 'Covers the requirements; content relevant and accurate (a few omissions or lapses); appropriate format. Key features covered and clearly highlighted but could be more fully illustrated. A CLEAR OVERVIEW is presented, data appropriately categorised, main trends or differences identified.',
  6: 'Focuses on the requirements; appropriate format. Key features covered and adequately highlighted. A relevant overview is attempted. Information appropriately selected and supported with figures from the data. Some irrelevant, inappropriate or inaccurate information in details; some details missing or excessive.',
  5: 'Generally addresses the requirements; format may be inappropriate in places. Key features not adequately covered; recounting of detail mainly mechanical. ⛔ There may be no data to support the description [limit: no_data]. May focus on details without the bigger picture — no overview [limit: no_overview]. Irrelevant, inappropriate or inaccurate material in key areas.',
  4: 'An attempt to address the task; few key features selected [limit: tangential]. ⛔ The format may be inappropriate. Key features presented may be irrelevant, repetitive, inaccurate or inappropriate.',
  3: 'Does not address the requirements (possibly misunderstanding the data). Limited, largely irrelevant information.',
  2: 'The content barely relates to the task. ⛔ The entire response may be off-topic [limit: off_topic].',
}

const TASK_GT1: Scale = {
  9: 'All requirements of the task are fully and appropriately satisfied; extremely rare lapses in content.',
  8: 'Covers all requirements appropriately, relevantly and sufficiently. All bullet points clearly presented and appropriately illustrated or extended. Occasional omissions or lapses.',
  7: 'Covers the requirements; content relevant and accurate; appropriate format. All bullet points covered and clearly highlighted but could be more fully extended. A clear purpose. The tone is consistent and appropriate to the task.',
  6: 'Focuses on the requirements; appropriate format. All bullet points covered and adequately highlighted. The purpose is generally clear. Minor inconsistencies in tone. Some irrelevant or inaccurate information in details; some details missing.',
  5: 'Generally addresses the requirements; format may be inappropriate in places. All bullet points presented, but one or more not adequately covered. The purpose may be unclear at times. The tone may be variable and sometimes inappropriate [limit: tone_mixed]. Limited detail.',
  4: '⛔ Not all bullet points are presented [limit: bullet_missing]. The purpose is not clearly explained and may be confused. ⛔ The tone may be inappropriate [limit: tone]. ⛔ The format may be inappropriate.',
  3: 'Does not address the requirements (possibly misunderstanding the situation). Bullet points largely irrelevant.',
  2: 'The content barely relates to the task. ⛔ The entire response may be off-topic [limit: off_topic].',
}

const COHERENCE: Scale = {
  9: 'The message can be followed effortlessly. Cohesion very rarely attracts attention; lapses minimal. Paragraphing is skilfully managed.',
  8: 'The message can be followed with ease. Information and ideas are logically sequenced; cohesion well managed; occasional lapses. Paragraphing used sufficiently and appropriately.',
  7: 'Logically organised; clear progression throughout (a few minor lapses). A range of cohesive devices, including reference and substitution, used flexibly but with some inaccuracies or over/under-use. Paragraphing generally effective; sequencing within paragraphs generally logical.',
  6: 'Generally coherent with a clear overall progression. Cohesive devices used to some good effect, but cohesion within and/or between sentences may be faulty or mechanical (misuse, overuse, omission). Reference and substitution may lack flexibility or clarity, causing some repetition or error. Paragraphing may not always be logical; the central topic may not always be clear.',
  5: 'Organisation evident but not wholly logical; may lack overall progression, though there is underlying coherence. Ideas can be followed but sentences are not fluently linked. Limited or overused cohesive devices with some inaccuracy. Repetitive because of inadequate reference and substitution. ⛔ (Task 2) Paragraphing may be inadequate or missing [limit: no_paragraphs].',
  4: 'Ideas evident but not arranged coherently; no clear progression. Relationships between ideas unclear or inadequately marked; basic cohesive devices, inaccurate or repetitive. Inaccurate or missing referencing. No paragraphs, or confusing ones.',
  3: 'No apparent logical organisation; ideas difficult to relate to each other. Minimal cohesive devices.',
}

const LEXIS: Scale = {
  9: 'Full flexibility and precise use widely evident. A wide range used accurately and appropriately with very natural and sophisticated control. Minor spelling or word-formation errors extremely rare.',
  8: 'A wide resource used fluently and flexibly to convey precise meanings. Skilful use of uncommon and/or idiomatic items when appropriate, despite occasional inaccuracies in word choice and collocation. Occasional spelling or word-formation errors with minimal impact.',
  7: 'The resource is sufficient for some flexibility and precision. Some ability to use less common and/or idiomatic items. Awareness of style and collocation, though inappropriacies occur. Only a few spelling or word-formation errors, not detracting from clarity.',
  6: 'The resource is generally adequate and appropriate. Meaning generally clear despite a rather restricted range or a lack of precision in word choice (a risk-taker: wider range, more inaccuracy). Some spelling or word-formation errors that do not impede communication.',
  5: 'The resource is limited but minimally adequate. Simple vocabulary may be accurate but the range does not permit much variation. Frequent lapses in appropriacy of word choice; frequent simplifications and/or repetitions. Noticeable spelling or word-formation errors that may cause some difficulty for the reader.',
  4: 'The resource is limited and inadequate for, ⛔ or unrelated to, the task. Basic vocabulary, used repetitively. Inappropriate memorised or formulaic chunks, or language copied from the prompt. Errors in word choice, formation or spelling may impede meaning.',
  3: 'Inadequate resource (possibly because the response is significantly underlength). Over-dependence on copied or memorised language. Errors predominate and may severely impede meaning.',
}

const GRAMMAR: Scale = {
  9: 'A wide range of structures used with full flexibility and control. Punctuation and grammar appropriate throughout. Minor errors extremely rare.',
  8: 'A wide range of structures flexibly and accurately used. THE MAJORITY OF SENTENCES ARE ERROR-FREE; punctuation well managed. Occasional, non-systematic errors with minimal impact.',
  7: 'A variety of complex structures used with some flexibility and accuracy. Grammar and punctuation generally well controlled; ERROR-FREE SENTENCES ARE FREQUENT. A few errors may persist but do not impede communication.',
  6: 'A mix of simple and complex sentence forms, but flexibility is limited. Complex structures are less accurate than simple ones. Errors in grammar and punctuation occur but rarely impede communication.',
  5: 'The range of structures is limited and rather repetitive. Complex sentences are attempted but tend to be faulty; the greatest accuracy is on simple sentences. Grammatical errors may be frequent and cause some difficulty for the reader. Punctuation may be faulty.',
  4: 'A very limited range of structures. ⛔ Subordinate clauses are rare and simple sentences predominate [limit: simple_only]. Some structures accurate, but grammatical errors are frequent and may impede meaning. Punctuation often faulty.',
  3: 'Sentence forms attempted, but errors in grammar and punctuation predominate and prevent most meaning from coming through.',
}

/** Ограничивающий признак шкалы: критерий не выше `max`. `byCode` — его находит наш код, а не модель. */
export interface IeltsLimit {
  crit: CritKey
  max: number
  kinds: readonly IeltsKind[]
  /** По-русски, для ученика: что не так. */
  ru: string
  /** Что сделать, чтобы потолок снялся. */
  how: string
  byCode?: boolean
}

const ALL: readonly IeltsKind[] = ['task2', 'academic1', 'gt1']

export const IELTS_LIMITS: Record<string, IeltsLimit> = {
  incomplete: { crit: 'task', max: 5, kinds: ['task2'], ru: 'Раскрыта не каждая часть вопроса', how: 'Ответь на каждую часть задания отдельным абзацем.' },
  tangential: { crit: 'task', max: 4, kinds: ALL, ru: 'Ответ мимо вопроса или слишком общий', how: 'Отвечай ровно на вопрос задания, а не на тему вообще.' },
  off_topic: { crit: 'task', max: 2, kinds: ALL, ru: 'Текст не по теме задания', how: 'Перечитай задание и пиши именно о нём.' },
  no_overview: { crit: 'task', max: 5, kinds: ['academic1'], ru: 'Нет обзора главных тенденций (overview)', how: 'Добавь абзац «Overall, …» с двумя-тремя главными тенденциями.' },
  no_data: { crit: 'task', max: 5, kinds: ['academic1'], ru: 'Описание без цифр из графика', how: 'Подкрепи каждую тенденцию цифрами из графика.' },
  bullet_missing: { crit: 'task', max: 4, kinds: ['gt1'], ru: 'Не раскрыт один из пунктов задания', how: 'Раскрой каждый из трёх пунктов задания отдельным абзацем.' },
  tone: { crit: 'task', max: 4, kinds: ['gt1'], ru: 'Тон письма не подходит адресату', how: 'Пиши тем тоном, какого ждёт адресат: официальному — без разговорных слов.' },
  tone_mixed: { crit: 'task', max: 5, kinds: ['gt1'], ru: 'Тон письма скачет — местами разговорный', how: 'Убери разговорные слова и держи один тон всё письмо.' },
  simple_only: { crit: 'grammar', max: 4, kinds: ALL, ru: 'Почти одни простые предложения', how: 'Соединяй мысли придаточными: because, although, which, when.' },
  no_paragraphs: { crit: 'coherence', max: 5, kinds: ['task2'], ru: 'Нет абзацев', how: 'Раздели текст на абзацы: вступление, 2–3 абзаца по идее, вывод.', byCode: true },
  bullets: { crit: 'task', max: 5, kinds: ALL, ru: 'Пункты списком вместо связного текста', how: 'Перепиши пункты связными предложениями.', byCode: true },
  // Не «жирные» признаки, а положительные, которые можно посчитать: доля
  // предложений без грамматических правок (examiner.ts, ERROR_FREE_*).
  errors_majority: { crit: 'grammar', max: 7, kinds: ALL, ru: 'Без ошибок меньше половины предложений', how: 'Перечитай каждое предложение: время глагола, артикль, согласование.', byCode: true },
  errors_frequent: { crit: 'grammar', max: 6, kinds: ALL, ru: 'Предложений без ошибок мало', how: 'Проверь в каждом предложении время глагола, артикль и согласование.', byCode: true },
}

/** Шкала критерия для этого вида задания: ступени сверху вниз, строкой для промпта. */
function scaleText(scale: Scale): string {
  return Object.keys(scale)
    .map(Number)
    .sort((a, b) => b - a)
    .map((b) => `${b}: ${scale[b]}`)
    .join('\n')
}

export function ieltsScale(kind: IeltsKind): string {
  const task = kind === 'task2' ? TASK_RESPONSE : kind === 'academic1' ? TASK_ACADEMIC1 : TASK_GT1
  const taskName = kind === 'task2' ? 'TASK RESPONSE (key: task)' : 'TASK ACHIEVEMENT (key: task)'
  return [
    `${taskName}\n${scaleText(task)}`,
    `COHERENCE AND COHESION (key: coherence)\n${scaleText(COHERENCE)}`,
    `LEXICAL RESOURCE (key: lexis)\n${scaleText(LEXIS)}`,
    `GRAMMATICAL RANGE AND ACCURACY (key: grammar)\n${scaleText(GRAMMAR)}`,
  ].join('\n\n')
}

/** Ограничивающие признаки, которые решает модель, — для этого вида задания. */
export function modelLimits(kind: IeltsKind): string[] {
  return Object.entries(IELTS_LIMITS)
    .filter(([, l]) => !l.byCode && l.kinds.includes(kind))
    .map(([id]) => id)
}
