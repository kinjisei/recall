/**
 * Примеры для check-ai-review (PLAN.md Ф2.20): сданная работа по материалу →
 * AI-разбор `generateAiReview` (черновик вердиктов для учителя). Критерии —
 * criteria.md (Р*, О*). Один запрос на пример.
 *
 * Ответ ученика: [упражнение, что ввёл, вердикт, почему, что назвать].
 * Вердикт — по правилу владельца «верно то, что верно в языке» (журнал
 * п.74): true — ответ верен, «неверно» здесь = придуманная ошибка (Р2);
 * false — ошибка в языке, «верно» здесь = пропущенная (Р1). Опечатка с
 * пропущенной буквой (playd) — ошибка; синоним, верный в предложении
 * (large вместо big), — верно; начертание, которое прощает сверка приложения
 * (регистр, диакритика), — верно (Р3). «Что назвать» должно стоять в
 * комментарии: у неверного по умолчанию — правильный ответ (Р4), у синонима
 * — слово из текста.
 * Авто-проверку (`auto_ok`) проверка считает настоящей сверкой приложения
 * (`lib/text.ts`), как у ученика. Пустой `given` — ученик не ответил.
 */

const mcq = (kind, prompt, options, answer) => ({ kind, type: 'mcq', prompt, options, answer })
const fill = (prompt, answer, hint) => ({ kind: 'grammar', type: 'fill', prompt, answer, ...(hint ? { hint } : {}) })
const order = (prompt, sentence) => {
  const answer = sentence.split(' ')
  return { kind: 'grammar', type: 'order', prompt, words: [...answer].reverse(), answer }
}

export const REVIEW = [
  {
    id: 'en-a2-ann',
    title: 'EN A2 · пропущенная буква, неправильный глагол, синоним, пропуск',
    material: {
      lang: 'en',
      level: 'A2',
      body:
        "Ann's Saturday\n\nLast Saturday Ann got up early. She played tennis with her brother in the park. The park was very big and green. " +
        'After the game they went to a café. Ann drank orange juice, and her brother had a cup of coffee. Ann doesn\'t like coffee. ' +
        'In the afternoon they visited their grandmother. She made a huge chocolate cake. In the evening Ann was very tired, so she went to bed at nine.',
    },
    items: [
      [mcq('comprehension', 'Where did Ann play tennis?', ['In the park', 'At school', 'At home', 'In the café'], 0), 'In the park', true],
      [mcq('comprehension', 'What did Ann drink in the café?', ['Coffee', 'Orange juice', 'Tea', 'Water'], 1), 'Coffee', false, 'кофе пил брат'],
      [fill('She ___ tennis with her brother in the park.', 'played', 'play в прошедшем времени'), 'playd', false, 'пропущена буква: played'],
      [fill('After the game they ___ to a café.', 'went', 'go в прошедшем времени'), 'goed', false, 'go — неправильный глагол: went'],
      [fill('Ann ___ coffee.', "doesn't like", 'not like, настоящее время'), "don't like", false, 'she → doesn\'t'],
      [fill('The park was very ___ and green.', 'big', 'большой'), 'large', true, 'синоним верен в предложении', 'big'],
      [order('Вечером Ann очень устала.', 'In the evening Ann was very tired'), 'In the evening Ann was very tired', true],
      [mcq('vocab', 'very, very big', ['huge', 'tiny', 'quiet', 'early'], 0), 'tiny', false],
      [fill('In the afternoon they ___ their grandmother.', 'visited', 'visit в прошедшем времени'), '', false, 'нет ответа'],
      [fill('In the evening Ann ___ very tired.', 'was', 'be в прошедшем времени'), 'Was', true, 'регистр'],
    ],
    judge: 'Р6: имя — Ann латиницей, не «Энн». Р4: у goed — что go неправильный и форма went.',
  },
  {
    id: 'en-b1-present-perfect',
    title: 'EN B1 · since и Present Perfect, сокращение, порядок слов в вопросе',
    material: {
      lang: 'en',
      level: 'B1',
      body:
        'A Year Abroad\n\nDaniel has lived in Madrid since last September. He came to Spain to study architecture, and he has already learned a lot of Spanish. ' +
        'At first he found the language difficult, but he has never thought about going home. He has made friends with two students from Italy, and they have just finished a big project together. ' +
        "Daniel has never been to London, although his sister lives there. He wants to visit her next summer. 'I've changed a lot this year,' he says. 'I've become more independent.'",
    },
    items: [
      [fill('Daniel ___ in Madrid since last September.', 'has lived', 'live, Present Perfect'), 'lives', false, 'since → Present Perfect'],
      [fill('Daniel ___ to London.', 'has never been', 'never / be'), "'s never been", true, 'сокращение — тоже верно'],
      [fill('He has made friends with two students from Italy, and they ___ a big project together.', 'have just finished', 'just / finish'), 'have just finish', false, 'нужна третья форма finished'],
      [fill('Daniel has never been to London, although his sister ___ there.', 'lives', 'live'), 'live', false, 'she → lives'],
      [order('Ты когда-нибудь был в Лондоне?', 'Have you ever been to London?'), 'You have ever been to London?', false, 'порядок слов в вопросе'],
      [mcq('comprehension', 'Why did Daniel come to Spain?', ['To work', 'To study architecture', 'To visit his sister', 'To learn Italian'], 1), 'To study architecture', true],
      [fill('He ___ more independent this year.', 'has become', 'become'), 'has became', false, 'третья форма — become'],
      [fill('He wants ___ her next summer.', 'to visit', 'visit'), 'to visit', true],
    ],
    judge: "Р2: 's never been — не ошибка. О3: объяснение since — верное (since + момент → Present Perfect).",
  },
  {
    id: 'es-a2-sevilla',
    title: 'ES A2 · неверная форма, ser/estar, согласование gustar, vosotros',
    material: {
      lang: 'es',
      level: 'A2',
      body:
        'Un viaje a Sevilla\n\nEl verano pasado, mi familia y yo fuimos a Sevilla. Viajamos en tren desde Madrid. El primer día visitamos la catedral y comimos tapas en un bar muy pequeño. ' +
        'A mi hermano le gustaron mucho las croquetas. Por la noche vimos un espectáculo de flamenco. Mi padre nos preguntó: «¿Queréis volver el año que viene?» ' +
        'Mi madre dice que fue el mejor viaje de su vida. Hoy mi hermana está un poco triste porque quiere volver a Sevilla.',
    },
    items: [
      [fill('El verano pasado, mi familia y yo ___ a Sevilla.', 'fuimos', 'ir, pretérito indefinido'), 'fuemos', false, 'форма ir: fuimos'],
      [fill('El primer día ___ tapas en un bar muy pequeño.', 'comimos', 'comer, pretérito indefinido'), 'comímos', true, 'лишнее ударение — начертание, сверка его прощает'],
      [fill('Hoy mi hermana ___ un poco triste.', 'está', 'ser или estar'), 'es', false, 'состояние → estar'],
      [fill('A mi hermano le ___ mucho las croquetas.', 'gustaron', 'gustar, pretérito indefinido'), 'gustó', false, 'las croquetas — мн. ч. → gustaron'],
      [mcq('comprehension', '¿Cómo viajaron a Sevilla?', ['En coche', 'En avión', 'En tren', 'En autobús'], 2), 'En tren', true],
      [mcq('vocab', 'Baile típico del sur de España, con guitarra y palmas.', ['el flamenco', 'la paella', 'la catedral', 'el tren'], 0), 'la paella', false],
      [fill('Mi padre nos preguntó: «¿___ volver el año que viene?»', 'Queréis', 'querer, vosotros'), 'Quieren', false, 'vosotros → queréis; не засчитывать как «латиноамериканский вариант»'],
      [order('Это была лучшая поездка в её жизни.', 'Fue el mejor viaje de su vida'), 'Fue el mejor viaje de su vida', true],
    ],
    judge: 'О4: про Quieren — не «в Латинской Америке так можно», а форма vosotros. О3: ser/estar объяснено верно (временное состояние).',
  },
  {
    id: 'es-b1-subjuntivo',
    title: 'ES B1 · subjuntivo: где нужен и где нет',
    material: {
      lang: 'es',
      level: 'B1',
      body:
        'Querida Elena:\n\n¡Qué ganas tengo de verte! Espero que vengas a Madrid en diciembre. Cuando llegues, te enseñaré mi barrio nuevo. ' +
        'Es importante que reservemos el hotel pronto, porque en Navidad todo está lleno. No creo que haga mucho frío, pero trae una chaqueta. ' +
        'Creo que te va a encantar el mercado de San Miguel. Ojalá podamos ir juntas al teatro.\n\nUn abrazo,\nMarta',
    },
    items: [
      [fill('Espero que ___ a Madrid en diciembre.', 'vengas', 'venir, tú'), 'vienes', false, 'esperar que → subjuntivo'],
      [fill('Cuando ___, te enseñaré mi barrio nuevo.', 'llegues', 'llegar, tú'), 'llegarás', false, 'cuando о будущем → subjuntivo, не futuro'],
      [fill('Es importante que ___ el hotel pronto.', 'reservemos', 'reservar, nosotras'), 'reservemos', true],
      [fill('No creo que ___ mucho frío.', 'haga', 'hacer'), 'haga', true],
      [fill('Creo que te ___ a encantar el mercado de San Miguel.', 'va', 'ir'), 'vaya', false, 'creo que → indicativo'],
      [mcq('comprehension', '¿Por qué hay que reservar el hotel pronto?', ['Porque es barato', 'Porque en Navidad todo está lleno', 'Porque Elena no tiene dinero', 'Porque el hotel cierra'], 1), 'Porque es barato', false],
      [order('Хоть бы мы смогли сходить вместе в театр.', 'Ojalá podamos ir juntas al teatro'), 'Ojalá podamos ir juntas al teatro', true],
    ],
    judge: 'О3 — главное: правило creo que / no creo que и cuando + subjuntivo объяснено верно, без выдумок.',
  },
  {
    id: 'en-c1-inversion',
    title: 'EN C1 · инверсия, сокращение would\'ve, синоним, пропуск',
    material: {
      lang: 'en',
      level: 'C1',
      body:
        'The Delay\n\nHad I known about the strike, I would have booked a different flight. Not only did the airline cancel our flight, but it also refused to offer us a hotel. ' +
        'No sooner had we reached the information desk than the queue doubled. Rarely have I seen such chaos at an airport. ' +
        'Only when a manager finally appeared did the passengers calm down. In hindsight, the whole experience was unexpected rather than dangerous.',
    },
    items: [
      [fill('Had I known about the strike, I ___ a different flight.', 'would have booked', 'book'), "would've booked", true, 'сокращение'],
      [fill('Not only ___ the airline cancel our flight, but it also refused to offer us a hotel.', 'did'), 'did', true],
      [fill('No sooner ___ we reached the information desk than the queue doubled.', 'had'), 'have', false, 'no sooner had … than'],
      [fill('Rarely ___ such chaos at an airport.', 'have I seen', 'I / see'), 'I have seen', false, 'после Rarely — инверсия'],
      [fill('Only when a manager finally appeared ___ the passengers calm down.', 'did'), '', false, 'нет ответа'],
      [fill('In hindsight, the whole experience was ___ rather than dangerous.', 'unexpected', 'неожиданный'), 'surprising', true, 'синоним верен в предложении', 'unexpected'],
      [mcq('vocab', 'thinking about a past event with knowledge you did not have at the time', ['in hindsight', 'in advance', 'in vain', 'in charge'], 0), 'in hindsight', true],
    ],
    judge: 'О5: объяснение инверсии понятно — «после Rarely порядок как в вопросе: have I seen».',
  },
  {
    id: 'en-b2-all-correct',
    title: 'EN B2 · всё верно (регистр, though вместо although) — ни одной придуманной ошибки',
    material: {
      lang: 'en',
      level: 'B2',
      body:
        'The Return of Vinyl\n\nVinyl records were once thought to be dead. However, sales have been rising for over fifteen years. ' +
        'Many young listeners say that a record makes music feel more personal: you have to choose an album, put it on and listen from start to finish. ' +
        'Although records are more expensive than streaming, fans are willing to pay for the experience. ' +
        "Some shops have even opened cafés where customers can listen to new releases. It's a trend that few people expected.",
    },
    items: [
      [mcq('comprehension', 'How long have vinyl sales been rising?', ['For five years', 'For over fifteen years', 'Since last year', 'For fifty years'], 1), 'For over fifteen years', true],
      [fill('However, sales ___ for over fifteen years.', 'have been rising', 'rise, Present Perfect Continuous'), 'have been rising', true],
      [fill('Vinyl records were once ___ to be dead.', 'thought', 'think'), 'Thought', true, 'регистр'],
      [fill('___ records are more expensive than streaming, fans are willing to pay for the experience.', 'Although', 'хотя'), 'Though', true, 'though = although'],
      [fill("It's a trend that ___ people expected.", 'few', 'мало кто'), 'few', true],
      [order('Некоторые магазины даже открыли кафе.', 'Some shops have even opened cafés'), 'Some shops have even opened cafés', true],
      [mcq('vocab', 'ready and happy to do something', ['willing', 'personal', 'expensive', 'dead'], 0), 'willing', true],
    ],
    judge: 'Р2 — главное: все вердикты «верно», комментарии пустые или короткая похвала, без «но лучше было бы…».',
  },
]
