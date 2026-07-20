// ============================================================================
// Неправильные глаголы английского — справочник и данные тренажёра.
// Сгруппированы по типу изменения (так проще запоминать закономерности).
// Модуль грузится ЛЕНИВО (await import) — только на экране «Грамматика» EN.
//
// past/part могут содержать варианты через «/» (was/were, got/gotten) —
// тренажёр принимает любой из них.
// ============================================================================

export interface IrregularVerb {
  base: string
  past: string
  part: string
  ru: string
}

export interface IrregularGroup {
  title: string
  note: string
  verbs: IrregularVerb[]
}

export const irregularGroups: IrregularGroup[] = [
  {
    title: 'Не меняются: put — put — put',
    note: 'Три одинаковые формы. Только read меняет произношение: рид → рэд.',
    verbs: [
      { base: 'cost', past: 'cost', part: 'cost', ru: 'стоить' },
      { base: 'cut', past: 'cut', part: 'cut', ru: 'резать' },
      { base: 'hit', past: 'hit', part: 'hit', ru: 'ударять' },
      { base: 'hurt', past: 'hurt', part: 'hurt', ru: 'причинять боль' },
      { base: 'let', past: 'let', part: 'let', ru: 'позволять' },
      { base: 'put', past: 'put', part: 'put', ru: 'класть' },
      { base: 'read', past: 'read', part: 'read', ru: 'читать' },
      { base: 'set', past: 'set', part: 'set', ru: 'устанавливать' },
      { base: 'shut', past: 'shut', part: 'shut', ru: 'закрывать' },
    ],
  },
  {
    title: 'Вторая = третья: buy — bought — bought',
    note: 'Самая большая группа: запоминаешь одну форму — знаешь две.',
    verbs: [
      { base: 'bring', past: 'brought', part: 'brought', ru: 'приносить' },
      { base: 'build', past: 'built', part: 'built', ru: 'строить' },
      { base: 'buy', past: 'bought', part: 'bought', ru: 'покупать' },
      { base: 'catch', past: 'caught', part: 'caught', ru: 'ловить' },
      { base: 'feel', past: 'felt', part: 'felt', ru: 'чувствовать' },
      { base: 'fight', past: 'fought', part: 'fought', ru: 'бороться' },
      { base: 'find', past: 'found', part: 'found', ru: 'находить' },
      { base: 'get', past: 'got', part: 'got/gotten', ru: 'получать' },
      { base: 'have', past: 'had', part: 'had', ru: 'иметь' },
      { base: 'hear', past: 'heard', part: 'heard', ru: 'слышать' },
      { base: 'hold', past: 'held', part: 'held', ru: 'держать' },
      { base: 'keep', past: 'kept', part: 'kept', ru: 'хранить' },
      { base: 'leave', past: 'left', part: 'left', ru: 'уходить' },
      { base: 'lend', past: 'lent', part: 'lent', ru: 'одалживать' },
      { base: 'lose', past: 'lost', part: 'lost', ru: 'терять' },
      { base: 'make', past: 'made', part: 'made', ru: 'делать' },
      { base: 'meet', past: 'met', part: 'met', ru: 'встречать' },
      { base: 'pay', past: 'paid', part: 'paid', ru: 'платить' },
      { base: 'say', past: 'said', part: 'said', ru: 'говорить' },
      { base: 'sell', past: 'sold', part: 'sold', ru: 'продавать' },
      { base: 'send', past: 'sent', part: 'sent', ru: 'отправлять' },
      { base: 'sit', past: 'sat', part: 'sat', ru: 'сидеть' },
      { base: 'sleep', past: 'slept', part: 'slept', ru: 'спать' },
      { base: 'spend', past: 'spent', part: 'spent', ru: 'тратить' },
      { base: 'stand', past: 'stood', part: 'stood', ru: 'стоять' },
      { base: 'teach', past: 'taught', part: 'taught', ru: 'обучать' },
      { base: 'tell', past: 'told', part: 'told', ru: 'рассказывать' },
      { base: 'think', past: 'thought', part: 'thought', ru: 'думать' },
      { base: 'understand', past: 'understood', part: 'understood', ru: 'понимать' },
      { base: 'win', past: 'won', part: 'won', ru: 'побеждать' },
    ],
  },
  {
    title: 'Первая = третья: come — came — come',
    note: 'Маленькая группа: третья форма возвращается к первой.',
    verbs: [
      { base: 'become', past: 'became', part: 'become', ru: 'становиться' },
      { base: 'come', past: 'came', part: 'come', ru: 'приходить' },
      { base: 'run', past: 'ran', part: 'run', ru: 'бежать' },
    ],
  },
  {
    title: 'i — a — u: begin — began — begun',
    note: 'Красивая цепочка гласных, как песня: swim — swam — swum.',
    verbs: [
      { base: 'begin', past: 'began', part: 'begun', ru: 'начинать' },
      { base: 'drink', past: 'drank', part: 'drunk', ru: 'пить' },
      { base: 'ring', past: 'rang', part: 'rung', ru: 'звонить' },
      { base: 'sing', past: 'sang', part: 'sung', ru: 'петь' },
      { base: 'swim', past: 'swam', part: 'swum', ru: 'плавать' },
    ],
  },
  {
    title: 'Три разные формы: know — knew — known',
    note: 'Самые ходовые глаголы — учить только наизусть.',
    verbs: [
      { base: 'be', past: 'was/were', part: 'been', ru: 'быть' },
      { base: 'break', past: 'broke', part: 'broken', ru: 'ломать' },
      { base: 'choose', past: 'chose', part: 'chosen', ru: 'выбирать' },
      { base: 'do', past: 'did', part: 'done', ru: 'делать' },
      { base: 'drive', past: 'drove', part: 'driven', ru: 'водить машину' },
      { base: 'eat', past: 'ate', part: 'eaten', ru: 'есть' },
      { base: 'fall', past: 'fell', part: 'fallen', ru: 'падать' },
      { base: 'fly', past: 'flew', part: 'flown', ru: 'летать' },
      { base: 'forget', past: 'forgot', part: 'forgotten', ru: 'забывать' },
      { base: 'give', past: 'gave', part: 'given', ru: 'давать' },
      { base: 'go', past: 'went', part: 'gone', ru: 'идти' },
      { base: 'grow', past: 'grew', part: 'grown', ru: 'расти' },
      { base: 'know', past: 'knew', part: 'known', ru: 'знать' },
      { base: 'ride', past: 'rode', part: 'ridden', ru: 'ехать верхом' },
      { base: 'rise', past: 'rose', part: 'risen', ru: 'подниматься' },
      { base: 'see', past: 'saw', part: 'seen', ru: 'видеть' },
      { base: 'show', past: 'showed', part: 'shown', ru: 'показывать' },
      { base: 'speak', past: 'spoke', part: 'spoken', ru: 'говорить' },
      { base: 'steal', past: 'stole', part: 'stolen', ru: 'красть' },
      { base: 'take', past: 'took', part: 'taken', ru: 'брать' },
      { base: 'throw', past: 'threw', part: 'thrown', ru: 'бросать' },
      { base: 'wake', past: 'woke', part: 'woken', ru: 'просыпаться' },
      { base: 'wear', past: 'wore', part: 'worn', ru: 'носить (одежду)' },
      { base: 'write', past: 'wrote', part: 'written', ru: 'писать' },
    ],
  },
]

/** Плоский список всех глаголов (для тренажёра). */
export const irregularVerbs: IrregularVerb[] = irregularGroups.flatMap((g) => g.verbs)
