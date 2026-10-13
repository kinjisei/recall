/**
 * Примеры для check-ai-material (PLAN.md Ф2.20): заявка учителя → план →
 * текст с упражнениями, и «Свой текст» → упражнения. Критерии — criteria.md
 * (М*, Д*, О*). Запросов: заявка — 2 (план и текст), «Свой текст» — 1.
 *
 * `students` — имена из students.mjs: материал «для кого» (один ученик или
 * группа); пусто — общий материал. `expect` — то, что проверка сверяет сама;
 * `judge` — на что судье смотреть в этом примере особо.
 */

export const MATERIAL = [
  {
    id: 'en-a1-family',
    title: 'EN A1 · «Моя семья» · слово не по уровню в заявке',
    req: {
      lang: 'en',
      level: 'A1',
      topic: 'Моя семья',
      format: 'рассказ',
      lengthRange: '50-100',
      vocabulary: 'mother, brother, kitchen, every day, nevertheless',
      grammar: 'Present Simple: he/she + -s',
    },
    students: [],
    expect: { planNoWords: ['nevertheless'] },
    judge:
      'М1: nevertheless (уровень B2) заменено на простое слово, и в comments сказано почему. ' +
      'М3: текст A1 — короткие предложения, только Present Simple. ' +
      'М6: he/she + -s встречается не меньше двух раз.',
  },
  {
    id: 'en-a2-nature-topic',
    title: 'EN A2 · сказка · в поле слов тема «природа» · один ученик',
    req: {
      lang: 'en',
      level: 'A2',
      topic: 'Поход в лес',
      format: 'сказка',
      lengthRange: '100-250',
      vocabulary: 'природа',
      grammar: 'Past Simple: неправильные глаголы',
    },
    students: ['en_a2_past'],
    expect: {
      planWordsCount: [6, 8],
      struggling: ['bought', 'through', 'forest', 'tired'],
    },
    judge:
      'М2: слова плана — про природу и уровня A2 (tree, river, hill…), не «biodiversity». ' +
      'Д1: bought, through, forest, tired — в тексте естественно, не списком. ' +
      'Д4: в тексте и упражнениях нет «ты путаешь…», «твои слабые места». Д5: comments говорят, что взято из диагностики.',
  },
  {
    id: 'en-b1-group-dialog',
    title: 'EN B1 · диалог · группа из трёх · учитель не задал ни слов, ни грамматики',
    req: {
      lang: 'en',
      level: 'B1',
      topic: 'Планы на выходные с друзьями',
      format: 'диалог двух людей',
      lengthRange: '100-250',
      vocabulary: '',
      grammar: '',
    },
    students: ['en_b1_group_1', 'en_b1_group_2', 'en_b1_group_3'],
    expect: {
      dialog: true,
      struggling: ['although', 'achieve', 'environment'],
      weakTopic: ['артикл', 'article', 'present perfect'],
    },
    judge:
      'Д2–Д3: грамматика плана — артикли (буксуют у 3 из 3) или Present Perfect / Past Simple (у 2 из 3), ' +
      'а не пассив (у одного). М12: каждая реплика «Имя: …». Д4: про группу и её ошибки в тексте ни слова.',
  },
  {
    id: 'en-b2-news-passive',
    title: 'EN B2 · новости 250–350 слов · пассив во всех временах',
    req: {
      lang: 'en',
      level: 'B2',
      topic: 'Город запрещает машины в центре',
      format: 'новости',
      lengthRange: '250-350',
      vocabulary: 'ban, emissions, commuter, pedestrian, controversial, enforce',
      grammar: 'Пассивный залог в разных временах (is being done, has been done, will be done)',
    },
    students: [],
    expect: {},
    judge:
      'М6: пассив минимум в трёх временах и без ошибок. М7: пропуски с пассивом однозначны — ' +
      'подсказка называет время. М8: вопросы по тексту не требуют знаний вне текста.',
  },
  {
    id: 'en-c1-blog-inversion',
    title: 'EN C1 · статья блога · слова подбирает AI · инверсия · один ученик',
    req: {
      lang: 'en',
      level: 'C1',
      topic: 'Удалённая работа: свобода или ловушка',
      format: 'статья блога',
      lengthRange: '250-350',
      vocabulary: '',
      grammar: 'Инверсия: Never have I…, Not only… but also, Rarely…',
    },
    students: ['en_c1_business'],
    expect: { struggling: ['notwithstanding', 'albeit'] },
    judge:
      'М3: это C1, а не B1 — сложные предложения, идиоматика; слова, предложенные AI, — уровня C1. ' +
      'М6: инверсия минимум дважды и верно. М7: у «собери предложение» с инверсией один правильный порядок.',
  },
  {
    id: 'es-a1-restaurant',
    title: 'ES A1 · диалог в ресторане · испанский Испании',
    req: {
      lang: 'es',
      level: 'A1',
      topic: 'En el restaurante',
      format: 'диалог двух людей',
      lengthRange: '50-100',
      vocabulary: 'la cuenta, el camarero, pedir, la carta, el agua',
      grammar: 'Presente: verbos regulares (-ar, -er, -ir)',
    },
    students: [],
    expect: { dialog: true },
    judge:
      'О4: camarero, а не mesero; к нескольким друзьям — vosotros, а не ustedes. ' +
      'М3: A1 — только presente. М7: в пропусках ясно, какое лицо (подсказка или подлежащее).',
  },
  {
    id: 'es-b1-email-imperf',
    title: 'ES B1 · письмо о детстве · indefinido или imperfecto · один ученик',
    req: {
      lang: 'es',
      level: 'B1',
      topic: 'Mi infancia en el pueblo',
      format: 'письмо / email',
      lengthRange: '100-250',
      vocabulary: 'solía, mientras, aunque, recuerdo, el pueblo',
      grammar: 'Pretérito indefinido или imperfecto',
    },
    students: ['es_b1_imperf'],
    expect: { struggling: ['solía', 'mientras', 'aunque', 'sin embargo'] },
    judge:
      'М7 — главное здесь: в пропуске «indefinido или imperfecto» часто подходят оба. ' +
      'Каждый пропуск должен иметь один ответ: маркер (cada verano, ayer, de repente) или подсказка. ' +
      'О3: объяснение выбора времени верное.',
  },
  {
    id: 'es-b2-interview-topic',
    title: 'ES B2 · интервью · в поле слов тема «trabajo» · subjuntivo',
    req: {
      lang: 'es',
      level: 'B2',
      topic: 'Entrevista con una arquitecta joven',
      format: 'интервью',
      lengthRange: '250-350',
      vocabulary: 'trabajo',
      grammar: 'Subjuntivo: ojalá, espero que, es importante que',
    },
    students: [],
    expect: { planWordsCount: [6, 8] },
    judge:
      'М2: слова — про работу и уровня B2 (plantilla, sueldo, jornada…). О4: ordenador, móvil; ' +
      'не computadora, celular. М6: subjuntivo после ojalá / espero que / es importante que — минимум трижды.',
  },
  {
    id: 'en-b1-own-text',
    title: 'EN B1 · «Свой текст» учителя · акцент Present Perfect',
    ownText: {
      lang: 'en',
      level: 'B1',
      accent: { vocabulary: 'recently, already, manage', grammar: 'Present Perfect' },
      body: [
        'Moving to a New City',
        '',
        'Anna has lived in Almaty for six months now. She moved here from a small town because she got a job at an IT company. At first, everything seemed difficult. She didn\'t know anyone, and the city felt huge.',
        '',
        'Since then, a lot has changed. Anna has already made a few friends at work, and she has recently joined a hiking club. Every Sunday the club goes to the mountains. Anna has managed to climb Big Almaty Peak twice, although the second time it rained all day.',
        '',
        'She hasn\'t visited all the famous places yet. Her brother is coming next month, and they are planning to see Charyn Canyon together. Anna says that the hardest part of moving was the first month. "Now I feel at home," she says. "I have never been so busy, but I have never been so happy."',
      ].join('\n'),
    },
    expect: {},
    judge:
      'М8 — главное: факты только из текста (шесть месяцев, IT-компания, клуб по воскресеньям, ' +
      'дважды на пик, дождь во второй раз, брат в следующем месяце, Чарын). М7: в пропусках Present Perfect ' +
      'против Past Simple ответ однозначен по тексту.',
  },
  {
    id: 'es-a2-own-text',
    title: 'ES A2 · «Свой текст» учителя · без акцента',
    ownText: {
      lang: 'es',
      level: 'A2',
      accent: {},
      body: [
        'Un fin de semana en Valencia',
        '',
        'El sábado pasado, Lucía y su amiga Marta fueron a Valencia en tren. El viaje duró dos horas. Primero visitaron la Ciudad de las Artes y las Ciencias y sacaron muchas fotos. Después comieron una paella en un restaurante cerca de la playa. Por la tarde pasearon por el centro y compraron un regalo para la madre de Lucía.',
        '',
        'El domingo hizo mucho calor, así que se bañaron en el mar. Volvieron a casa por la noche, muy cansadas pero contentas.',
      ].join('\n'),
    },
    expect: {},
    judge:
      'М8: факты только из текста. М7: пропуски с indefinido однозначны. ' +
      'О4: вопросы и варианты — испанский Испании.',
  },
]
