/**
 * Юнит-проверка единой сверки ответов (src/lib/text.ts).
 *
 * Зачем отдельным файлом: answerMatches — единственная точка, где решается
 * «верно/неверно» для ВСЕХ напечатанных ответов (fill и order в грамматике и
 * заданиях преподавателя, перепроверка слов, диктант, неправильные глаголы).
 * Ровно то же правило продублировано на сервере (norm_typed в docs/schema.sql,
 * блок «НОРМАЛИЗАЦИЯ ПЕЧАТНОГО ОТВЕТА»), поэтому таблица случаев ниже —
 * общая: её же прогоняют по SQL при сверке клиента с сервером.
 *
 * Запуск: node scripts/test-answermatches.mjs
 */
import { answerMatches, normalizeAnswer } from '../src/lib/text.ts'

/** [что напечатал, что ждём, ожидаемый вердикт, комментарий] */
export const CASES = [
  // --- было и раньше -------------------------------------------------------
  ['was', 'was/were', true, 'вариант через «/»'],
  ['WERE', 'was/were', true, 'вариант через «/» + регистр'],
  ['burned', 'burnt/burned', true, 'вариант через «/»'],
  ['  hello   world ', 'hello world', true, 'лишние пробелы схлопнуты'],
  ['ESTÁ', 'esta', true, 'испанская диакритика снимается'],
  ['esta', 'está', true, 'диакритика снимается и со стороны ответа'],
  ['ЁЛКА', 'елка', true, 'ё и е — одно и то же'],
  ['cat', 'dog', false, 'разные слова остаются разными'],
  ['', 'hello', false, 'пустой ответ не проходит'],

  // --- добавлено 2026-08-09 (находка ревью 2А №7) --------------------------
  ['well known', 'well-known', true, 'дефис = пробел'],
  ['well-known', 'well known', true, 'дефис = пробел (в другую сторону)'],
  ['twenty one', 'twenty-one', true, 'дефис в числительных'],
  ['dont', "don't", true, 'апостроф не обязателен'],
  ['don’t', "don't", true, 'кавычка-апостроф ’ (так пишет AI) = обычный ´'],
  ["don't", 'don’t', true, 'и в обратную сторону'],
  ['Hello.', 'Hello', true, 'точка в конце не считается'],
  ['Yes', 'Yes.', true, 'точка в конце ответа задания тоже'],
  ['Hello!!', 'Hello', true, 'любая финальная пунктуация'],
  ['he is at home.', 'He is at home', true, 'предложение с точкой'],

  // --- сознательно НЕ склеиваем -------------------------------------------
  ['email', 'e-mail', false, 'дефис — пробел, а не ноль символов'],
  ['in to', 'into', false, 'пробел внутри слова остаётся различием'],
  ['I go, home', 'I go home', false, 'внутреннюю пунктуацию не трогаем'],
  ['', '.', false, 'ответ из одного знака не совпадает с пустым'],
  ['.', '.', true, 'ответ-знак сравнивается сам с собой'],

  // --- принятая плата за необязательный апостроф ---------------------------
  // Для НАПЕЧАТАННОГО ответа «its» засчитается как «it's». В mcq (выбор из
  // готовых вариантов) этого не происходит: там сервер сверяет строгим
  // norm_answer, и пара вариантов «It's»/«Its» остаётся разной.
  ['its', "it's", true, 'осознанное следствие: апостроф необязателен'],
]

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

for (const [given, expected, want, why] of CASES) {
  const got = answerMatches(given, expected)
  check(
    `${JSON.stringify(given)} vs ${JSON.stringify(expected)} → ${want ? 'верно' : 'неверно'}`,
    got === want,
    got === want ? why : `получили ${got ? 'верно' : 'неверно'} (${why})`,
  )
}

// нормализация идемпотентна: повторный прогон ничего не меняет
const sample = ['  Don’t—stop. ', 'Well-Known!!', 'ÉSTÁ', 'well known']
check(
  'normalizeAnswer идемпотентна',
  sample.every((s) => normalizeAnswer(normalizeAnswer(s)) === normalizeAnswer(s)),
)
// и не превращает непустой ответ в пустую строку
check(
  'непустой ответ не схлопывается в пустоту',
  ['...', '!', '-', '’'].every((s) => normalizeAnswer(s).length > 0),
  JSON.stringify(['...', '!', '-', '’'].map((s) => normalizeAnswer(s))),
)

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
