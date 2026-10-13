/**
 * Правила проверки качества AI (scripts/ai-quality/rules.mjs, PLAN.md Ф2.20):
 * на хорошем ответе модели — всё зелёное, на испорченном — краснеет ровно тот
 * критерий, который испорчен. Без этого вечерний прогон с живой моделью мог
 * бы «позеленеть» на сломанном правиле.
 *
 * Хорошие ответы — scripts/ai-quality/fake-answers.mjs (те же, что у
 * `check-ai-* --fake`); порча — здесь, по одной на критерий.
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-ai-quality-rules.mjs
 */
import { FAKE } from './ai-quality/fake-answers.mjs'
import { MATERIAL } from './ai-quality/examples/material.mjs'
import { REVIEW } from './ai-quality/examples/review.mjs'
import { WRITING, WRITING_TASKS } from './ai-quality/examples/writing.mjs'
import { PROGRAM } from './ai-quality/examples/program.mjs'
import { materialRules, reviewRules, writingRules, writingTaskRules, programRules, hasWord, isQuote, fillFromText } from './ai-quality/rules.mjs'
import { validExercises } from '../src/lib/materialExercises.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const clone = (o) => structuredClone(o)
const byId = (list, id) => list.find((e) => e.id === id)
const red = (rows) => rows.filter((r) => !r.ok).map((r) => r.id)
/** Испортили одно — красный ровно этот критерий. */
const onlyRed = (name, rows, id) => check(name, red(rows).join() === id, `красные: ${red(rows).join(', ') || 'нет'}`)

// ── помощники сравнения ─────────────────────────────────────────────────────
check('слово в другой форме находится (bought → buy нет, tired → tired)', hasWord('She was very tired.', 'tired') && !hasWord('I buy it', 'bought'))
check('фраза — по каждому слову (every day)', hasWord('He cooks every single day', 'every day'))
check('артикль в слове плана не мешает (la cuenta)', hasWord('Pedimos la cuenta.', 'la cuenta'))
check('цитата с кривым апострофом и регистром — цитата', isQuote("He don't like it", 'he don’t like'))
check('цитата с пропуском «…» — по кускам', isQuote('I went to the park and then I saw a dog', 'I went … saw a dog'))
check('выдуманная цитата — не цитата', !isQuote('I went to the park', 'I goed to the park'))
check('пропуск из текста — с любым из «a/b»', fillFromText('There were two cats.', { prompt: 'There ___ two cats.', answer: 'was/were' }))
check('пропуск не из текста — нет', !fillFromText('There were two cats.', { prompt: 'There ___ three dogs.', answer: 'were' }))

// ── материал ────────────────────────────────────────────────────────────────
{
  const ex = byId(MATERIAL, 'en-a1-family')
  const build = (planText, contentText) => {
    const plan = JSON.parse(planText)
    const c = JSON.parse(contentText)
    return { plan, content: { title: c.title, body: c.body, exercises: validExercises(c.exercises) }, raw: { exercises: c.exercises } }
  }
  const good = build(...FAKE['en-a1-family'])
  check('материал: хороший ответ — всё зелёное', red(materialRules(ex, good)).length === 0, red(materialRules(ex, good)).join(', '))
  check('материал: проверены М1, М4, М5, М8–М11, О2', ['М1', 'М4', 'М5', 'М8', 'М9', 'М10', 'М11', 'О2'].every((id) => materialRules(ex, good).some((r) => r.id === id)))

  const p1 = clone(good)
  p1.plan.vocabulary.push('nevertheless')
  p1.content.body += ' Nevertheless, we are happy.'
  onlyRed('М1: слово не по уровню осталось в плане', materialRules(ex, p1), 'М1')

  const p4 = clone(good)
  p4.content.body += ' ' + 'We like it. '.repeat(20)
  onlyRed('М4: текст длиннее заявленного', materialRules(ex, p4), 'М4')

  const p5 = clone(good)
  p5.content.body = p5.content.body.replace('He likes the kitchen very much.', 'He likes it.')
  p5.content.exercises = p5.content.exercises.filter((e) => !String(e.prompt).includes('kitchen'))
  p5.raw.exercises = p5.raw.exercises.filter((e) => !String(e.prompt).includes('kitchen'))
  check('М5: слова плана нет в тексте', red(materialRules(ex, p5)).includes('М5'))

  const p8 = clone(good)
  p8.content.exercises[3].prompt = 'She ___ in a small school.'
  p8.raw.exercises[3].prompt = 'She ___ in a small school.'
  onlyRed('М8: пропуск не из текста', materialRules(ex, p8), 'М8')

  const p9 = clone(good)
  p9.raw.exercises[5].words = ['school', 'goes', 'He', 'at']
  p9.content.exercises = validExercises(p9.raw.exercises)
  check('М9: «собери» не собирается — выброшено', red(materialRules(ex, p9)).includes('М9'))

  const p10 = clone(good)
  p10.content.exercises[7].prompt = 'the kitchen is where you cook food'
  p10.raw.exercises[7].prompt = p10.content.exercises[7].prompt
  onlyRed('М10: слово в своём определении', materialRules(ex, p10), 'М10')

  const p11 = clone(good)
  p11.raw.exercises.reverse()
  p11.content.exercises.reverse()
  onlyRed('М11: порядок упражнений перевёрнут', materialRules(ex, p11), 'М11')

  const pO2 = clone(good)
  pO2.content.exercises[3].hint = 'add -s'
  pO2.raw.exercises[3].hint = 'add -s'
  onlyRed('О2: подсказка не по-русски', materialRules(ex, pO2), 'О2')

  const group = byId(MATERIAL, 'en-b1-group-dialog')
  const g = clone(good)
  g.content.body = 'Anna: Hi!\nBen: Hello, although it is late.\nAnna: We can achieve a lot.\nBen: The environment matters.\nAnna: Bye!'
  g.plan.grammar_focus = 'Артикли a / the'
  g.content.exercises.push({ kind: 'vocab', type: 'mcq', prompt: 'to succeed', options: ['achieve', 'late', 'bye', 'hi'], answer: 0 })
  const gRows = materialRules(group, g)
  check('Д1, Д2, М12: группа — слова, тема и реплики найдены', ['Д1', 'Д2', 'М12'].every((id) => gRows.find((r) => r.id === id)?.ok), red(gRows).join(', '))
  const g2 = clone(g)
  g2.content.body = g2.content.body.replace('although', 'but')
  g2.plan.grammar_focus = 'Пассивный залог'
  g2.content.body = g2.content.body.replace(/^Ben: /gm, '')
  const g2Rows = red(materialRules(group, g2))
  check('Д1, Д2, М12: без слова, без слабой темы, без «Имя:» — красные', ['Д1', 'Д2', 'М12'].every((id) => g2Rows.includes(id)), g2Rows.join(', '))
}

// ── разбор работы ───────────────────────────────────────────────────────────
{
  const ex = byId(REVIEW, 'en-a2-ann')
  const build = (text) => {
    const raw = JSON.parse(text)
    const review = ex.items.map((_, i) => raw.items.find((x) => x.index === i) ?? { index: i, ok: false, comment: '' })
    return { review, raw }
  }
  const good = build(FAKE['en-a2-ann'][0])
  check('разбор: хороший ответ — всё зелёное', red(reviewRules(ex, good)).length === 0, red(reviewRules(ex, good)).join(', '))

  const r1 = clone(good)
  r1.review[3] = { index: 3, ok: true, comment: 'Верно, went.' }
  onlyRed('Р1: goed засчитан', reviewRules(ex, r1), 'Р1')
  const r2 = clone(good)
  r2.review[6] = { index: 6, ok: false, comment: 'Неверный порядок слов.' }
  onlyRed('Р2: придумана ошибка в верном ответе', reviewRules(ex, r2), 'Р2')
  const r3 = clone(good)
  r3.review[5] = { index: 5, ok: true, comment: 'Верно.' }
  onlyRed('Р3: синоним без «в тексте big»', reviewRules(ex, r3), 'Р3')
  const r4 = clone(good)
  r4.review[2] = { index: 2, ok: false, comment: 'Ошибка в написании.' }
  onlyRed('Р4: неверно, но без правильного ответа', reviewRules(ex, r4), 'Р4')
  const r5 = clone(good)
  r5.raw.items = r5.raw.items.filter((x) => x.index !== 8)
  onlyRed('Р5: модель пропустила упражнение', reviewRules(ex, r5), 'Р5')
  const rO2 = clone(good)
  rO2.review[1].comment = 'Wrong: she drank orange juice.'
  check('О2: комментарий по-английски', red(reviewRules(ex, rO2)).includes('О2'))
}

// ── письмо ──────────────────────────────────────────────────────────────────
{
  const ex = byId(WRITING, 'en-b1-work')
  const grade = JSON.parse(FAKE['en-b1-work'][0])
  const good = { grade, raw: grade }
  check('письмо: хороший разбор — всё зелёное', red(writingRules(ex, good)).length === 0, red(writingRules(ex, good)).join(', '))

  const w = (mut) => {
    const o = clone(good)
    mut(o.grade)
    o.raw = o.grade
    return writingRules(ex, o)
  }
  onlyRed('П1: «было» не из текста', w((g) => g.errors.push({ was: 'I goed home', fix: 'I went home' })), 'П1')
  check('П2: найдено меньше 80 % подложенного', red(w((g) => { g.errors = g.errors.slice(0, 2); g.focus[0].examples = g.focus[0].examples.slice(0, 1) })).includes('П2'))
  onlyRed('П3: исправлена верная фраза', w((g) => g.errors.push({ was: 'I answer emails', fix: 'I am answering emails' })), 'П3')
  onlyRed('П4: he don\'t → didn\'t', w((g) => { g.errors[2].fix = "he didn't like" }), 'П4')
  onlyRed('П5: шесть типов в фокусе', w((g) => { g.focus = Array.from({ length: 6 }, () => g.focus[0]) }), 'П5')
  onlyRed('П8: «употребил» не совпадает с текстом', w((g) => { g.targetWords[0].used = false }), 'П8')
  onlyRed('П8: уровень вне коридора', w((g) => { g.level = 'C1' }), 'П8')
  onlyRed('О2: пояснение по-английски', w((g) => { g.improve = ['Revise prepositions'] }), 'О2')

  const ielts = byId(WRITING, 'ielts-t2-55')
  const ig = JSON.parse(FAKE['ielts-t2-55'][0])
  check('IELTS: хороший разбор — всё зелёное', red(writingRules(ielts, { grade: ig, raw: ig })).length === 0, red(writingRules(ielts, { grade: ig, raw: ig })).join(', '))
  const hi = { ...clone(ig), band: 7 }
  onlyRed('П6: балл 7 при эталоне 5–6', writingRules(ielts, { grade: hi, raw: hi }), 'П6')
  const skew = { ...clone(ig), criteria: { task: 8, coherence: 8, lexis: 7, grammar: 7 } }
  onlyRed('П6: балл не сходится с критериями', writingRules(ielts, { grade: skew, raw: skew }), 'П6')

  const pie = byId(WRITING_TASKS, 'gen-chart-pie')
  const chart = (values) => ({ prompt: 'The pie chart shows … Summarise the information by selecting and reporting the main features.', chart: { kind: 'pie', series: [{ name: 'Share', points: values.map((v, i) => ({ label: `S${i}`, value: v })) }] } })
  check('П10: доли дают 100 % — зелёное', red(writingTaskRules(pie, chart([40, 30, 20, 10]))).length === 0)
  onlyRed('П10: доли дают 120 %', writingTaskRules(pie, chart([50, 40, 20, 10])), 'П10')
  const q = byId(WRITING_TASKS, 'gen-ielts-task2')
  check('П10: вопрос IELTS — зелёное', red(writingTaskRules(q, { prompt: 'Some people think that university education should be free. To what extent do you agree or disagree?' })).length === 0)
  onlyRed('П10: вопрос по-русски', writingTaskRules(q, { prompt: 'Некоторые считают, что образование должно быть бесплатным. Согласны ли вы?' }), 'П10')
}

// ── программа ───────────────────────────────────────────────────────────────
{
  const ex = byId(PROGRAM, 'en-a2-travel')
  // уровни уроков — литералами из каталога (src/data/english/grammar, нумерация приложения)
  const catalog = new Map([[2, 'A1'], [14, 'A2'], [18, 'A2'], [19, 'A2'], [26, 'B1'], [52, 'C1']])
  const raw = JSON.parse(FAKE['en-a2-travel'][0])
  const good = { plan: clone(raw), raw }
  check('программа: хороший ответ — всё зелёное', red(programRules(ex, good, catalog)).length === 0, red(programRules(ex, good, catalog)).join(', '))
  const p = (mut) => {
    const r = clone(raw)
    mut(r)
    return programRules(ex, { plan: r, raw: r }, catalog)
  }
  onlyRed('Пр1: недель меньше, чем просили', p((r) => r.weeks.pop()), 'Пр1')
  onlyRed('Пр1: в неделе один тип пунктов', p((r) => { r.weeks[2].items = r.weeks[2].items.map((it) => ({ ...it, type: 'words' })) }), 'Пр1')
  onlyRed('Пр2: выдуманный номер урока', p((r) => { r.weeks[2].items[0].topicId = 555 }), 'Пр2')
  onlyRed('Пр3: слабые темы не в первых неделях', p((r) => { r.weeks[0].items[0].topicId = 18; r.weeks[1].items[0].topicId = 19 }), 'Пр3')
  onlyRed('Пр4: урок C1 ученику A2', p((r) => { r.weeks[3].items[0].topicId = 52 }), 'Пр4')
  onlyRed('О2: пояснение по-английски', p((r) => { r.weeks[0].items[1].note = 'Learn 5 words a day.' }), 'О2')
}

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
