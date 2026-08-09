// ============================================================================
// Темы для письменных работ, которые ученик берёт САМ.
//
// Почему список, а не генерация через AI: тема нужна мгновенно и бесплатно.
// Генерация стоила бы дорогой Pro-вызов на каждый заход, работала бы 20 секунд
// и упиралась бы в месячный лимит — ради текста, который и так пишется один
// раз. Проверку работы AI делает по-прежнему: она и есть ценность.
//
// Формулировки IELTS намеренно близки к экзаменационным (Task 2 — мнение,
// обсуждение, проблема-решение; Task 1 General — письмо), чтобы человек
// тренировал именно тот формат, который его ждёт.
// ============================================================================
import type { CEFRLevel, WritingMode } from '../types'

export interface WritingPrompt {
  id: string
  mode: WritingMode
  /** Минимальный уровень, с которого тема осмысленна. */
  level: CEFRLevel
  /** Короткое название для списка. */
  title: string
  /** Само задание — уходит в задание и в промпт проверки. */
  prompt: string
}

export const WRITING_PROMPTS: WritingPrompt[] = [
  // ---- IELTS Task 2: мнение --------------------------------------------
  {
    id: 'ielts-remote-work',
    mode: 'ielts',
    level: 'B1',
    title: 'Работа из дома',
    prompt:
      'Some people think that working from home is better than working in an office. ' +
      'To what extent do you agree or disagree? Give reasons for your answer and include ' +
      'any relevant examples from your own knowledge or experience. Write at least 250 words.',
  },
  {
    id: 'ielts-free-university',
    mode: 'ielts',
    level: 'B2',
    title: 'Бесплатное образование',
    prompt:
      'Some people believe that university education should be free for everyone. ' +
      'Others think students should pay for it themselves. Discuss both views and give ' +
      'your own opinion. Write at least 250 words.',
  },
  {
    id: 'ielts-city-traffic',
    mode: 'ielts',
    level: 'B1',
    title: 'Пробки в городах',
    prompt:
      'Traffic in big cities is getting worse every year. What are the main causes of this ' +
      'problem, and what measures could be taken to solve it? Write at least 250 words.',
  },
  {
    id: 'ielts-social-media',
    mode: 'ielts',
    level: 'B2',
    title: 'Соцсети и общение',
    prompt:
      'Some people say that social media has made face-to-face communication worse. ' +
      'To what extent do you agree or disagree? Support your answer with examples. ' +
      'Write at least 250 words.',
  },
  {
    id: 'ielts-english-global',
    mode: 'ielts',
    level: 'C1',
    title: 'Английский как мировой язык',
    prompt:
      'The dominance of English as a global language brings more benefits than problems. ' +
      'Discuss this statement, considering the effects on smaller languages and cultures. ' +
      'Write at least 250 words.',
  },
  // ---- IELTS Task 1 General: письма -------------------------------------
  {
    id: 'ielts-letter-complaint',
    mode: 'ielts',
    level: 'B1',
    title: 'Письмо-жалоба',
    prompt:
      'You recently bought a laptop online, and it arrived damaged. Write a letter to the ' +
      'shop. In your letter: describe what you ordered, explain what is wrong with it, ' +
      'and say what you want them to do. Write at least 150 words. Begin "Dear Sir or Madam,".',
  },
  {
    id: 'ielts-letter-friend',
    mode: 'ielts',
    level: 'A2',
    title: 'Письмо другу',
    prompt:
      'A friend is coming to visit your city for the first time. Write a letter to your ' +
      'friend. In your letter: say when you are free, suggest two places to visit, ' +
      'and explain how to get from the airport. Write at least 150 words.',
  },
  {
    id: 'ielts-letter-job',
    mode: 'ielts',
    level: 'B2',
    title: 'Письмо работодателю',
    prompt:
      'You saw an advertisement for a summer job at a language school. Write a letter to ' +
      'the manager. In your letter: explain why you are interested, describe your relevant ' +
      'experience, and ask about working hours. Write at least 150 words.',
  },

  // ---- Обычные эссе (без экзаменационных критериев) ---------------------
  {
    id: 'reg-my-day',
    mode: 'regular',
    level: 'A1',
    title: 'Мой обычный день',
    prompt:
      'Опиши свой обычный день: когда встаёшь, что делаешь утром, днём и вечером. ' +
      '8–12 предложений в настоящем времени.',
  },
  {
    id: 'reg-last-trip',
    mode: 'regular',
    level: 'A2',
    title: 'Последняя поездка',
    prompt:
      'Расскажи о поездке, которая тебе запомнилась: куда ездил, с кем, что делал, ' +
      'что понравилось больше всего. 10–15 предложений в прошедшем времени.',
  },
  {
    id: 'reg-favourite-film',
    mode: 'regular',
    level: 'A2',
    title: 'Любимый фильм',
    prompt:
      'Напиши о фильме или сериале, который тебе нравится: о чём он, кто главный герой, ' +
      'почему стоит посмотреть. 10–15 предложений.',
  },
  {
    id: 'reg-future-plans',
    mode: 'regular',
    level: 'B1',
    title: 'Планы на год',
    prompt:
      'Чего ты хочешь добиться в ближайший год и что для этого будешь делать? ' +
      'Используй будущее время и конструкции планов. 12–18 предложений.',
  },
  {
    id: 'reg-city-change',
    mode: 'regular',
    level: 'B1',
    title: 'Что изменить в моём городе',
    prompt:
      'Что бы ты изменил в своём городе и почему? Опиши проблему, предложи решение ' +
      'и объясни, кому это поможет. 12–18 предложений.',
  },
  {
    id: 'reg-argument',
    mode: 'regular',
    level: 'B2',
    title: 'Спорное мнение',
    prompt:
      'Выбери утверждение, с которым ты не согласен, и объясни почему. Приведи два ' +
      'аргумента и один контраргумент, с которым ты частично соглашаешься. 15–20 предложений.',
  },
]

/** Порядок уровней — чтобы отбирать «не выше моего». */
const ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/**
 * Темы, подходящие человеку: не выше его уровня. Если уровень неизвестен
 * (тест не пройден), показываем всё — пусть выбирает сам, а не упирается в
 * пустой список.
 */
export function promptsFor(level: CEFRLevel | null, mode?: WritingMode): WritingPrompt[] {
  const cap = level ? ORDER.indexOf(level) : ORDER.length - 1
  return WRITING_PROMPTS.filter(
    (p) => (!mode || p.mode === mode) && ORDER.indexOf(p.level) <= cap,
  )
}
