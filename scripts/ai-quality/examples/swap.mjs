/**
 * Примеры замера замены упражнения (PLAN.md Ф2.25-4а, журнал п.76 (22)):
 * по одному на каждый вид каталога (`lib/exerciseFormats`) и каверзные
 * True / False; A2 и B1, английский и испанский — поровну. У каждого — текст,
 * заменяемое упражнение и остальные упражнения материала (не повторять).
 * Критерии — `criteria.md`, раздел «Замена упражнения».
 */

const AIRPORT = [
  'Last summer Dana flew from Almaty to Istanbul. She came to the airport early, but the screen said: “Delay — 3 hours”. Dana was not happy. She bought a coffee and waited near the gate.',
  '',
  'The plane left very late, and in Istanbul Dana had only forty minutes for her next flight. She ran through the airport with her boarding pass in her hand. But the gate was already closed. She missed her flight!',
  '',
  'A woman at the desk was very kind. She gave Dana a ticket for the evening flight. Then Dana went to get her luggage, but her bag was not there. “Don’t worry,” the woman said. “It is on the next plane.” Dana laughed. What a day!',
].join('\n')

const MOVING = [
  'Moving to a New City',
  '',
  "Anna has lived in Almaty for six months now. She moved here from a small town because she got a job at an IT company. At first, everything seemed difficult. She didn't know anyone, and the city felt huge.",
  '',
  'Since then, a lot has changed. Anna has already made a few friends at work, and she has recently joined a hiking club. Every Sunday the club goes to the mountains. Anna has managed to climb Big Almaty Peak twice, although the second time it rained all day.',
  '',
  "She hasn't visited all the famous places yet. Her brother is coming next month, and they are planning to see Charyn Canyon together. Anna says that the hardest part of moving was the first month. \"Now I feel at home,\" she says. \"I have never been so busy, but I have never been so happy.\"",
].join('\n')

const VALENCIA = [
  'Un fin de semana en Valencia',
  '',
  'El sábado pasado, Lucía y su amiga Marta fueron a Valencia en tren. El viaje duró dos horas. Primero visitaron la Ciudad de las Artes y las Ciencias y sacaron muchas fotos. Después comieron una paella en un restaurante cerca de la playa. Por la tarde pasearon por el centro y compraron un regalo para la madre de Lucía.',
  '',
  'El domingo hizo mucho calor, así que se bañaron en el mar. Volvieron a casa por la noche, muy cansadas pero contentas.',
].join('\n')

// испанский Испании (журнал п.74): ordenador, heladería
const TRABAJO = [
  'Mi primer trabajo',
  '',
  'Cuando tenía diecisiete años, trabajé un verano en una heladería de Málaga. La tienda estaba cerca del puerto y siempre había mucha gente, sobre todo por la tarde. Mi jefa, Carmen, era muy simpática, pero también muy exigente: quería que todo estuviera limpio antes de abrir.',
  '',
  'El primer día rompí dos copas y me equivoqué con el cambio tres veces. Estaba tan nervioso que casi no dormí esa noche. Sin embargo, poco a poco aprendí a preparar los helados más rápido y a hablar con los clientes en inglés. Al final del verano, Carmen me dijo que podía volver el año siguiente. Con el dinero que gané, me compré mi primer ordenador.',
].join('\n')

const ex = {
  airportMcq: { kind: 'comprehension', type: 'mcq', prompt: 'Why did Dana wait near the gate for three hours?', options: ['Her flight had a delay.', 'She came to the airport late.', 'She wanted a coffee.', 'Her bag was lost.'], answer: 0 },
  airportTf: { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana missed her flight because she came to the airport late.', options: ['True', 'False'], answer: 1, quote: 'She came to the airport early', mark: 'early', why: 'В тексте — она приехала рано' },
  airportPairs: { kind: 'vocab', type: 'match', format: 'translation', prompt: 'Соедини слово и перевод', pairs: [{ left: 'delay', right: 'задержка' }, { left: 'gate', right: 'выход на посадку' }, { left: 'luggage', right: 'багаж' }, { left: 'miss a flight', right: 'опоздать на рейс' }], extra: ['паспорт'] },
  airportFill: { kind: 'grammar', type: 'fill', prompt: 'She ___ (buy) a coffee and waited near the gate.', answer: 'bought', hint: 'Past Simple от buy' },
  airportWord: { kind: 'vocab', type: 'mcq', prompt: 'The bags and suitcases you take on a trip.', options: ['luggage', 'ticket', 'gate', 'desk'], answer: 0 },
  movingMcq: { kind: 'comprehension', type: 'mcq', prompt: 'Why did Anna move to Almaty?', options: ['She got a job at an IT company.', 'Her brother lives there.', 'She wanted to climb mountains.', 'She studies at a university.'], answer: 0 },
  movingTf: { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Anna has climbed Big Almaty Peak three times.', options: ['True', 'False', 'Not given'], answer: 1, quote: 'Anna has managed to climb Big Almaty Peak twice', mark: 'twice', why: 'В тексте — дважды' },
  movingDef: { kind: 'vocab', type: 'match', format: 'definition', prompt: 'Соедини слово и объяснение', pairs: [{ left: 'huge', right: 'very, very big' }, { left: 'join', right: 'become a member of a group' }, { left: 'manage', right: 'succeed in doing something difficult' }, { left: 'recently', right: 'not long ago' }, { left: 'canyon', right: 'a deep valley with steep sides' }], extra: ['a very small town'] },
  movingFill: { kind: 'grammar', type: 'fill', prompt: 'Anna ___ (live) in Almaty for six months now.', answer: 'has lived', hint: 'Present Perfect' },
  valenciaTf: { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Lucía y Marta fueron a Valencia en coche.', options: ['Verdadero', 'Falso'], answer: 1, quote: 'Lucía y su amiga Marta fueron a Valencia en tren', mark: 'en tren', why: 'В тексте — на поезде' },
  valenciaMcq: { kind: 'comprehension', type: 'mcq', prompt: '¿Qué comieron en el restaurante?', options: ['Una paella', 'Un helado', 'Una pizza', 'Pescado frito'], answer: 0 },
  valenciaFillWord: { kind: 'vocab', type: 'fill', prompt: 'Por la tarde pasearon por el centro y compraron un ___ para la madre de Lucía.', answer: 'regalo' },
  valenciaForm: { kind: 'grammar', type: 'fill', prompt: 'El domingo ___ (hacer) mucho calor.', answer: 'hizo', hint: 'pretérito indefinido' },
  trabajoPairs: { kind: 'vocab', type: 'match', format: 'translation', prompt: 'Соедини слово и перевод', pairs: [{ left: 'heladería', right: 'кафе-мороженое' }, { left: 'puerto', right: 'порт' }, { left: 'jefa', right: 'начальница' }, { left: 'exigente', right: 'требовательный' }, { left: 'el cambio', right: 'сдача' }], extra: ['зарплата'] },
  trabajoOrder: { kind: 'grammar', type: 'order', prompt: 'Моя начальница была очень симпатичной.', words: ['jefa', 'Mi', 'muy', 'era', 'simpática'], answer: ['Mi', 'jefa', 'era', 'muy', 'simpática'] },
  trabajoForm: { kind: 'grammar', type: 'mcq', format: 'form', prompt: 'El primer día ___ dos copas.', options: ['rompí', 'rompía', 'rompo', 'romperé'], answer: 0 },
  trabajoMcq: { kind: 'comprehension', type: 'mcq', prompt: '¿Dónde estaba la heladería?', options: ['Cerca del puerto', 'En el centro comercial', 'Al lado de la playa', 'En Madrid'], answer: 0 },
}

const en2 = { body: AIRPORT, lang: 'en', level: 'A2', words: ['delay', 'gate', 'boarding pass', 'luggage', 'miss a flight'], grammar: 'Past Simple' }
const en1 = { body: MOVING, lang: 'en', level: 'B1', words: ['recently', 'already', 'manage'], grammar: 'Present Perfect' }
const es2 = { body: VALENCIA, lang: 'es', level: 'A2', words: [], grammar: 'pretérito indefinido' }
const es1 = { body: TRABAJO, lang: 'es', level: 'B1', words: ['heladería', 'exigente', 'equivocarse'], grammar: 'pretérito imperfecto e indefinido' }

export const SWAP = [
  { id: 'en-a2-mcq', title: 'EN A2 · Выбери ответ', ...en2, format: 'mcq', replacing: ex.airportMcq, others: [ex.airportTf, ex.airportPairs, ex.airportFill] },
  { id: 'es-a2-tfng', title: 'ES A2 · Verdadero / Falso', ...es2, format: 'tfng', replacing: ex.valenciaTf, others: [ex.valenciaMcq, ex.valenciaForm] },
  { id: 'en-b1-tfng-tricky', title: 'EN B1 · True / False / Not given, каверзные', ...en1, format: 'tfng', tricky: true, replacing: ex.movingTf, others: [ex.movingMcq, ex.movingDef, ex.movingFill] },
  { id: 'es-b1-match-tr', title: 'ES B1 · Соедини слово и перевод (5 пар)', ...es1, format: 'match_translation', pairs: 5, replacing: ex.trabajoPairs, others: [ex.trabajoMcq, ex.trabajoForm] },
  { id: 'en-b1-match-def', title: 'EN B1 · Соедини слово и объяснение (5 пар)', ...en1, format: 'match_definition', pairs: 5, replacing: ex.movingDef, others: [ex.movingMcq, ex.movingTf, ex.movingFill] },
  { id: 'en-a2-word-def', title: 'EN A2 · Слово по объяснению', ...en2, format: 'word_by_definition', replacing: ex.airportWord, others: [ex.airportMcq, ex.airportPairs] },
  { id: 'es-a2-fill-word', title: 'ES A2 · Вставь слово из текста', ...es2, format: 'fill_word', replacing: ex.valenciaFillWord, others: [ex.valenciaMcq, ex.valenciaTf] },
  { id: 'en-a2-fill-form', title: 'EN A2 · Вставь форму (Past Simple)', ...en2, format: 'fill_form', replacing: ex.airportFill, others: [ex.airportMcq, ex.airportTf] },
  { id: 'es-b1-order', title: 'ES B1 · Собери предложение', ...es1, format: 'order', replacing: ex.trabajoOrder, others: [ex.trabajoMcq, ex.trabajoForm] },
  { id: 'es-b1-form', title: 'ES B1 · Выбери правильную форму', ...es1, format: 'form', replacing: ex.trabajoForm, others: [ex.trabajoMcq, ex.trabajoPairs] },
]
