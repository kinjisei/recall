/**
 * Примеры для check-ai-writing (PLAN.md Ф2.20): разбор письма `gradeWriting`
 * (IELTS и обычный режим) и задания IELTS, которые AI придумывает учителю.
 * Критерии — criteria.md (П*, О*). Один запрос на пример.
 *
 * Тексты учеников написаны под эталон: в каждом — подложенные ошибки
 * (`planted`, фрагмент должен попасть в «было» хотя бы одной правки или
 * примера фокуса), верные фразы-ловушки (`traps`, их не исправлять) и
 * ловушки времени (`tense`: исправление обязано содержать `must` и не
 * содержать `not`). `band` и `level` — коридор эталона: баллы — наша
 * оценка текста, а не экзаменатора; настоящие эссе с официальным баллом
 * добавим, когда найдутся (решение владельца, журнал п.74).
 */

const CHART = {
  kind: 'bar',
  title: 'Households with internet access, 2005–2020',
  xLabel: 'Year',
  yLabel: 'Households',
  unit: '%',
  series: [
    { name: 'Country A', points: [['2005', 12], ['2010', 31], ['2015', 54], ['2020', 78]] },
    { name: 'Country B', points: [['2005', 40], ['2010', 58], ['2015', 71], ['2020', 86]] },
    { name: 'Country C', points: [['2005', 25], ['2010', 27], ['2015', 30], ['2020', 33]] },
  ].map((s) => ({ name: s.name, points: s.points.map(([label, value]) => ({ label, value })) })),
}

export const WRITING = [
  {
    id: 'ielts-t2-55',
    title: 'IELTS Task 2 · эссе на ~5,5 · артикли, «discuss about», «informations»',
    task: {
      lang: 'en',
      mode: 'ielts',
      level: 'B1',
      settings: { ieltsTask: 'task2' },
      prompt:
        'Some people believe that children should start learning a foreign language at primary school, while others think it is better to begin in secondary school. Discuss both views and give your own opinion.',
    },
    essay: `Nowadays many parents discuss about the best age for learning a foreign language. Some people think that children should start at primary school, but others believe that it is better to wait until secondary school. In this essay I will discuss both views.

On the one hand, young children learn languages more easier than adults. Their brain is like a sponge and they can remember new words very fast. If child starts to learn English at the age of seven, he will have more time to practise and he will speak without accent. Also, at primary school lessons are usually based on games and songs, so children do not feel stress.

On the other hand, some people says that primary school students are too young. They still learn their native language, and a second language can confuse them. Moreover, many schools do not have good teachers, so children get wrong informations and make a lot of mistakes which are difficult to correct later. When they will go to secondary school, they will need to learn everything again.

In my opinion, both approaches have their merits. However, I believe that it is better to start early, because it gives children big advantage in the future. Government should invest more money in training teachers for primary schools.

To sum up, although there are some disadvantages, early learning is more useful. Parents and schools should work together to make this process interesting for children.`,
    expect: {
      band: [5, 6],
      planted: ['discuss about', 'more easier', 'If child starts', 'some people says', 'wrong informations', 'When they will go', 'big advantage', 'Government should'],
      traps: ['In my opinion, both approaches have their merits.', 'Parents and schools should work together to make this process interesting for children.'],
    },
    judge: 'П5: в фокусе — артикли (три случая: child, big advantage, Government). О5: why — понятно, чем мешает.',
  },
  {
    id: 'ielts-t2-7',
    title: 'IELTS Task 2 · сильное эссе на ~7 · три мелочи и верная инверсия-ловушка',
    task: {
      lang: 'en',
      mode: 'ielts',
      level: 'C1',
      settings: { ieltsTask: 'task2' },
      prompt:
        'In many countries, more and more people are working from home. Do the advantages of this trend outweigh the disadvantages?',
    },
    essay: `Over the past decade, remote work has shifted from a rare privilege to a common arrangement in many countries. While this trend brings undeniable benefits for both employees and companies, its drawbacks, particularly for younger workers, are often underestimated. Nevertheless, on balance, I believe the advantages outweigh the disadvantages.

The most obvious benefit is the time and money saved on commuting. In large cities such as Almaty, a daily journey to the office can easily take two hours, and with less commuters on the roads, traffic and air pollution are also reduced. Furthermore, many employees report that they concentrate better at home, where they are not interrupted by colleagues or noisy open-plan offices. For companies, remote work is an useful way to cut the cost of renting office space.

However, working from home is not without its problems. Junior employees, in particular, learn a great deal simply by observing more experienced colleagues, and this kind of informal learning is difficult to reproduce online. Had employers anticipated this, they would have invested earlier in mentoring programmes. In addition, the boundary between work and private life tends to blur, and some people find themselves answering emails late at night. Whether remote work succeeds therefore depends from how well it is organised.

In conclusion, although remote work can isolate employees and weaken team culture, these problems can be addressed through regular meetings and clear rules. The savings in time, money and stress are substantial, and for this reason I am convinced that the benefits of working from home outweigh its drawbacks.`,
    expect: {
      band: [6.5, 7.5],
      planted: ['less commuters', 'an useful', 'depends from'],
      traps: ['Had employers anticipated this, they would have invested earlier in mentoring programmes.', 'this kind of informal learning is difficult to reproduce online'],
    },
    judge: 'Не придирается: правок по делу — три, стилистика не выдаётся за ошибки. Балл не занижен из-за трёх мелочей.',
  },
  {
    id: 'ielts-gt1-letter',
    title: 'IELTS GT Task 1 · жалоба · разговорные слова в официальном письме',
    task: {
      lang: 'en',
      mode: 'ielts',
      level: 'B1',
      settings: { ieltsTask: 'gt1' },
      prompt:
        'You recently bought a coffee machine from an online shop, but it stopped working after one week. Write a letter to the company. In your letter: describe the problem; explain what you have already done; say what you would like the company to do. Begin your letter as follows: Dear Sir or Madam,',
    },
    essay: `Dear Sir or Madam,

I am writing to complain about coffee machine which I bought in your online shop on 3 March. Hey, honestly, I was super happy at first, but after one week it stopped to work. When I press the button, the light is on, but the water don't come out.

I have already tried to fix it by myself. I cleaned the machine as it is written in the instruction and I called to your support line two times, but nobody answered. I also wrote an email, but I didn't receive any answer yet.

I am very disappointed, because I paid 150 dollars for this machine and I used it only for seven days. I wanna get my money back or a new machine as soon as possible. Please contact with me by phone or email.

I look forward to hearing from you.

Yours faithfully,
Aigerim Sadykova`,
    expect: {
      band: [5, 6.5],
      planted: ['about coffee machine', 'stopped to work', "water don't come out", 'called to your support line', "didn't receive any answer yet", 'contact with me', 'wanna'],
      traps: ['I look forward to hearing from you.'],
      tense: [{ was: "don't come out", must: "doesn't", not: "didn't" }],
    },
    judge: 'Регистр: «Hey, honestly, super happy», «wanna» названы как неуместные в официальном письме (в фокусе или improve).',
  },
  {
    id: 'ielts-ac1-chart',
    title: 'IELTS Academic Task 1 · график · неверная цифра, неверный тренд, лишнее мнение',
    task: {
      lang: 'en',
      mode: 'ielts',
      level: 'B1',
      settings: { ieltsTask: 'academic1', chart: CHART },
      prompt:
        'The chart below shows the percentage of households with internet access in three countries between 2005 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    },
    essay: `The chart show the percent of households which had internet access in three countries from 2005 to 2020.

Overall, the share of households with internet grew in all countries except Country C, and Country B had the highest figures during the whole period.

In 2005 only 12% of households in Country A had internet, which was the lowest figure. However, this number rose rapidly and in 2015 it reached 45%. By 2020 almost four in five homes in Country A were online.

Country B started from 40% and increased steadily to 86% in the 2020. It was the leader in every year shown.

Country C decreased slightly over the period, from 25% to 33%. This is probably because people in Country C are not interested in technology.

To sum up, two countries showed a strong growth, while the third one changed only a little.`,
    expect: {
      band: [5, 6],
      taskMax: 6,
      planted: ['The chart show', 'reached 45%', 'Country C decreased slightly', 'in the 2020', 'except Country C', 'not interested in technology'],
      traps: ['Country B had the highest figures during the whole period.', 'By 2020 almost four in five homes in Country A were online.'],
    },
    judge: 'П7: 45% против 54% по данным, «decreased» при росте 25→33, мнение о причинах — отмечены как ошибки Task Achievement.',
  },
  {
    id: 'en-a2-weekend',
    title: 'Эссе EN A2 · выходные · неправильные глаголы · одно целевое слово не употреблено',
    task: {
      lang: 'en',
      mode: 'regular',
      level: 'A2',
      settings: { targetWords: ['cinema', 'delicious', 'tired'], targetGrammar: ['Past Simple'] },
      prompt: 'Напиши о своих прошлых выходных: где был, что делал, что понравилось (60–100 слов).',
    },
    essay: `Last weekend was very good. On Saturday I goed to the cinema with my friends. We watched a funny film about a dog. After the film we eated pizza in a small cafe. The pizza was delicious! Then I buyed a new T-shirt for my brother. On Sunday I stayed at home and read a book. In the evening my parents and I go to my grandmother. She cook a big dinner for us. It were a nice weekend.`,
    expect: {
      level: ['A1', 'A2'],
      planted: ['goed', 'eated', 'buyed', 'I go to my grandmother', 'She cook', 'It were'],
      traps: ['On Sunday I stayed at home and read a book.'],
      words: { cinema: true, delicious: true, tired: false },
    },
    judge: 'П5: фокус — «неправильные глаголы в прошедшем» (goed, eated, buyed) одной закономерностью, а не тремя пунктами.',
  },
  {
    id: 'en-b1-work',
    title: 'Эссе EN B1 · о работе · предлоги · ловушки «he don\'t» и «I am agree»',
    task: {
      lang: 'en',
      mode: 'regular',
      level: 'B1',
      settings: { targetWords: ['deadline', 'colleague', 'responsible'], targetGrammar: ['Present Simple', 'Present Continuous'] },
      prompt: 'Расскажи о своей работе или учёбе: что ты делаешь, что нравится и что нет (100–150 слов).',
    },
    essay: `I work as a manager in a small travel company in Astana. I am responsible for organising tours for groups of tourists. Every day I answer emails, talk to hotels and prepare documents. I am really interested on my job because I can use English and Spanish.

At the moment I am preparing a big tour to Turkey for forty people. It depends of many things, for example the weather and flight prices. My boss is very nice, but he don't like when we miss a deadline. My colleague Dana helps me with the hotels, and we often have lunch together.

Sometimes I arrive to the office at 8 o'clock and leave very late. I am agree that this job is stressful, but I like it.`,
    expect: {
      level: ['A2', 'B1'],
      planted: ['interested on', 'depends of', "he don't like", 'arrive to the office', 'I am agree'],
      traps: ['Every day I answer emails, talk to hotels and prepare documents.', 'At the moment I am preparing a big tour to Turkey for forty people.'],
      tense: [
        { was: "he don't like", must: "doesn't", not: "didn't" },
        { was: 'I am agree', must: 'I agree', not: 'agreed' },
      ],
      words: { deadline: true, colleague: true, responsible: true },
    },
    judge: 'П4: время не сдвинуто. П5: фокус — предлоги после глаголов и прилагательных (три случая).',
  },
  {
    id: 'es-a2-familia',
    title: 'Эссе ES A2 · семья · ser/estar, род, gustar · «piso» не трогать',
    task: {
      lang: 'es',
      mode: 'regular',
      level: 'A2',
      settings: { targetWords: ['hermano', 'cariñoso', 'trabajar', 'vivir'], targetGrammar: ['SER y ESTAR', 'presente de indicativo'] },
      prompt: 'Describe a tu familia: quiénes son, cómo son y qué hacen (80–120 palabras).',
    },
    essay: `Mi familia no es muy grande. Vivo en Almaty con mis padres y mi hermano. Mi padre se llama Asan y trabaja en un banco. Es muy serio pero simpático. Mi madre es profesora de matemáticas. Hoy mi madre es cansada porque tiene muchos exámenes. Mi hermano tiene veinte años y es muy alta. Estudia en la universidad y tambien trabaja en una cafetería los fines de semana. Me gusta los perros, pero en nuestro piso no hay espacio para un perro. Tenemos un gato que se llama Barsik. Cuando hay la problema, siempre hablamos juntos.`,
    expect: {
      level: ['A1', 'A2'],
      planted: ['es cansada', 'es muy alta', 'tambien', 'Me gusta los perros', 'hay la problema'],
      traps: ['Vivo en Almaty con mis padres y mi hermano.', 'en nuestro piso'],
      words: { hermano: true, 'cariñoso': false, trabajar: true, vivir: true },
    },
    judge: 'О4: «piso» — норма Испании, не меняется на «departamento». О3: ser/estar — «состояние сейчас → estar», без выдумок.',
  },
  {
    id: 'es-b1-viaje',
    title: 'Эссе ES B1 · поездка · indefinido/imperfecto, subjuntivo · «móvil» не трогать',
    task: {
      lang: 'es',
      mode: 'regular',
      level: 'B1',
      settings: { targetWords: ['aunque', 'mientras', 'recuerdo'], targetGrammar: ['pretérito indefinido e imperfecto', 'subjuntivo con ojalá'] },
      prompt: 'Cuenta un viaje que hiciste: adónde fuiste, cómo era el lugar y qué pasó (120–180 palabras).',
    },
    essay: `El año pasado fui con mis amigos a Granada. Recuerdo que hacía mucho calor y que las calles estaban llenas de turistas. Cuando era pequeño, fui a la playa cada verano con mis padres, pero no conocía ninguna ciudad tan bonita como Granada.

El primer día visitamos la Alhambra. Mientras caminábamos por los jardines, encontramos un grupo de músicos que tocaban la guitarra. La gente eran muy simpáticos y nos explicaron muchas cosas sobre la historia de la ciudad. Aunque estábamos cansados, por la noche salimos a cenar tapas.

El último día perdí mi móvil en el autobús, pero un conductor me lo devolvió. Me sorprendió mucho, porque no esperaba que alguien lo encuentra.

Me gustó mucho este viaje. Ojalá que vuelvo pronto a Granada con mi familia.`,
    expect: {
      level: ['A2', 'B1'],
      planted: ['fui a la playa cada verano', 'La gente eran muy simpáticos', 'lo encuentra', 'Ojalá que vuelvo'],
      traps: ['Mientras caminábamos por los jardines, encontramos un grupo de músicos que tocaban la guitarra.', 'perdí mi móvil'],
      words: { aunque: true, mientras: true, recuerdo: true },
    },
    judge: 'О3: «cada verano → iba» объяснено как привычное действие в прошлом. О4: móvil не меняется на celular.',
  },
]

/** Задания IELTS, которые AI придумывает учителю (задача material). */
export const WRITING_TASKS = [
  {
    id: 'gen-chart-pie',
    title: 'Задание Academic Task 1 · круговая диаграмма · доли дают 100 %',
    chart: { kind: 'pie', topic: 'Источники электроэнергии в стране' },
    expect: { pieSum: [98, 102], points: [4, 8] },
    judge: 'П10: вопрос в стиле IELTS, данные правдоподобны, подписи короткие.',
  },
  {
    id: 'gen-ielts-task2',
    title: 'Задание IELTS Task 2 · вопрос эссе',
    ielts: 'task2',
    expect: { latinOnly: true },
    judge: 'П10: спорное утверждение и формулировка экзамена (agree or disagree / discuss both views), не тривиально.',
  },
]
