// ============================================================================
// Самокоррекция: сперва показываем ГДЕ ошибка, ответ — только потом.
//
// Зачем. Готовый правильный ответ, показанный сразу, закрывает работу: человек
// сверяет две строки и идёт дальше, а попытки найти ошибку самому — той самой,
// которая и запоминается — не происходит. Самостоятельно найденное и
// исправленное держится лучше исправленного за тебя. Поэтому первая неудачная
// попытка даёт ПОДСКАЗКУ О МЕСТЕ ошибки, ответ появляется со второй попытки
// или по явной просьбе.
//
// ⚠️ Правило одно на ВСЕ упражнения: выбор, вписать, собрать предложение —
// и в грамматике, и в заданиях преподавателя, и в словах. Иначе ученик учится
// разному поведению на соседних экранах, а мы — чиним одно и то же трижды.
//
// ⚠️ БАЛЛ СЧИТАЕТСЯ ПО ПЕРВОЙ ПОПЫТКЕ. Вторая попытка нужна, чтобы человек
// нашёл ошибку сам, а не чтобы поднять цифру: иначе «8 из 10» перестаёт
// значить «знает восемь» и преподаватель планирует урок по выдумке. Поэтому
// onAnswered/onGiven вызываются РОВНО ОДИН РАЗ — на первой проверке.
// ============================================================================
import { normalizeAnswer } from './text.ts'

/** Сколько попыток даём до показа ответа. */
export const ATTEMPTS_BEFORE_ANSWER = 2

/** Слова ответа для сравнения (нормализованные, пустые выброшены). */
function words(s: string): string[] {
  return normalizeAnswer(s).split(' ').filter(Boolean)
}

/**
 * Первое расхождение двух последовательностей. -1 — совпадают целиком
 * (до длины меньшей из них).
 */
export function firstWrongIndex(given: string[], answer: string[]): number {
  const n = Math.min(given.length, answer.length)
  for (let i = 0; i < n; i++) {
    if (normalizeAnswer(given[i] ?? '') !== normalizeAnswer(answer[i] ?? '')) return i
  }
  return given.length === answer.length ? -1 : n
}

/** Длина общего начала двух строк (в символах, нормализованно). */
function commonPrefix(a: string, b: string): number {
  const x = normalizeAnswer(a)
  const y = normalizeAnswer(b)
  let i = 0
  while (i < x.length && i < y.length && x[i] === y[i]) i++
  return i
}

/**
 * Где ошибка — БЕЗ самого ответа.
 *
 * ⚠️ Ни одна ветка не должна возвращать текст ответа или его кусок: подсказка,
 * из которой ответ восстанавливается, — это тот же ответ, только с лишним
 * нажатием. Поэтому говорим ПОЗИЦИЮ и КОЛИЧЕСТВО, а не содержание. Проверяется
 * тестом (scripts/test-material-exercises.mjs).
 */
export function mistakeHint(given: string, answer: string): string {
  const g = words(given)
  const a = words(answer)

  if (g.length === 0) return 'Пустой ответ — попробуй написать хоть что-то.'

  // Ответ из одного слова: сравниваем по буквам.
  if (a.length === 1) {
    const same = commonPrefix(given, answer)
    if (same === 0) return 'Начало слова другое — подумай, с чего оно начинается.'
    if (same >= normalizeAnswer(answer).length) return 'Почти: лишнее в конце.'
    return `Первые ${same} ${same === 1 ? 'буква верна' : 'буквы верны'} — дальше не так.`
  }

  if (g.length !== a.length) {
    return `Слов должно быть ${a.length}, у тебя ${g.length}.`
  }

  const i = firstWrongIndex(g, a)
  if (i === -1) return 'Разница в мелочи — проверь знаки и написание.'
  if (i === 0) return 'Ошибка в первом слове.'
  return `Первые ${i} ${i === 1 ? 'слово верно' : 'слова верны'} — ошибка дальше.`
}

/** Подсказка для «собери предложение»: сколько слов уже на месте. */
export function orderHint(built: string[], answer: string[]): string {
  if (built.length !== answer.length) {
    return `Слов должно быть ${answer.length}, у тебя ${built.length}.`
  }
  const i = firstWrongIndex(built, answer)
  if (i === -1) return 'Порядок верный — проверь форму слов.'
  if (i === 0) return 'Первое слово не то.'
  return `Первые ${i} ${i === 1 ? 'слово на месте' : 'слова на месте'} — дальше нет.`
}

/** Подсказка для выбора: ответ не называем, говорим сколько осталось. */
export function mcqHint(optionsLeft: number): string {
  if (optionsLeft <= 1) return 'Остался один вариант.'
  return `Не то. Осталось вариантов: ${optionsLeft}.`
}

/**
 * Показывать ли ответ: попытки кончились или человек сам попросил.
 *
 * ⚠️ Зовут её ВСЕ упражнения — в этом и смысл. Пока экраны повторяли
 * `n >= ATTEMPTS_BEFORE_ANSWER` каждый у себя (пять копий), тест проверял эту
 * функцию, а продукт жил по своим копиям: разойдись они — тест бы не заметил.
 */
export function shouldReveal(attempts: number, asked = false): boolean {
  return asked || attempts >= ATTEMPTS_BEFORE_ANSWER
}
