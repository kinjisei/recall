import type { CEFRLevel } from '../../types'

export interface SampleText {
  id: string
  level: CEFRLevel
  title: string
  body: string
}

// Встроенные тексты-образцы (понятный ввод, i+1).
// Позже Фича 4 (AI) сможет генерировать тексты под уровень и интересы.
export const sampleTexts: SampleText[] = [
  // --- A1/A2 (авторский контент Recall): простые живые истории для новичка.
  // A1 — Present Simple, be/have, самые частотные слова; A2 — Past Simple,
  // going to, can/must. Перевод — как везде: тап по слову (WordSheet).
  {
    id: 'a1-family',
    level: 'A1',
    title: 'My little sister',
    body: `My name is Anna. I have a big family: a mother, a father and two sisters. My little sister Kira is five years old. She has a cat. The cat's name is Boss, because he is big and lazy. Kira loves him very much. But every night the cat sleeps on my bed, not on her bed. Kira is sad, and I am happy!`,
  },
  {
    id: 'a1-pizza',
    level: 'A1',
    title: 'Pizza day',
    body: `It is Friday. Friday is pizza day in our house. My dad makes the pizza, and I help him. We have cheese, tomatoes and ham. My mum does not eat ham, so her pizza is small and green: only vegetables. The kitchen is warm, the music is loud. I love Fridays.`,
  },
  {
    id: 'a1-flat',
    level: 'A1',
    title: 'Our new flat',
    body: `We have a new flat. It is small, but I like it. My room is white, and the window is very big. From the window I see a park and a school. We have no sofa now, so we sit on boxes and drink tea. Dad says: "The sofa comes on Monday." It is like a picnic at home.`,
  },
  {
    id: 'a1-morning',
    level: 'A1',
    title: 'Seven in the morning',
    body: `Every morning is the same. Mum opens my door at seven o'clock and says: "Good morning!" I say: "Five minutes, please." Then our dog runs into my room and jumps on my bed. Now I am not sleepy! We eat breakfast together, and I walk to school with my friend Tim. I like our mornings.`,
  },

  {
    id: 'a2-wrong-bus',
    level: 'A2',
    title: 'The wrong bus',
    body: `Last summer I went to the sea with my friend Dana. At the bus station we bought tickets, drank coffee and talked a lot. Then we got on the bus and slept for two hours. When we woke up, we saw mountains — but our sea town has no mountains! We took the wrong bus. Dana laughed, but I wanted to cry. A kind driver helped us, and we arrived late at night. Now, before every trip, I check the bus number three times.`,
  },
  {
    id: 'a2-first-job',
    level: 'A2',
    title: 'My first job',
    body: `Two years ago I got my first job in a small café. On my first day I was very nervous. I dropped a cup, forgot an order and put salt in a cappuccino. I wanted to go home and never come back. But my boss said: "Everybody makes mistakes on the first day. Tomorrow you are going to do better." She was right. After a month I could make ten drinks without mistakes, and people started to remember my name.`,
  },
  {
    id: 'a2-red-jacket',
    level: 'A2',
    title: 'The red jacket',
    body: `Yesterday I went shopping because I needed a warm jacket. In the first shop I found a beautiful red jacket, but it cost too much. The shop assistant said: "You must buy it, red is your colour!" I said no and went home. At home I thought about that jacket all evening. Today the shop sent me an email: the jacket is thirty percent off. I am going to buy it tomorrow morning. Sometimes it is good to wait!`,
  },
  {
    id: 'a2-coffee',
    level: 'A2',
    title: 'Too much coffee',
    body: `Last month I felt tired every day and could not sleep at night. I went to the doctor. She asked me many questions: "Do you do sport? What do you eat? How much coffee do you drink?" I said: "Five or six cups a day." The doctor smiled and said: "There is your problem. You must drink less coffee and walk more." I did not believe her, but I tried. After two weeks I slept like a baby. Now I drink one cup in the morning — and no coffee after lunch.`,
  },
  {
    id: 'a2-picnic-rain',
    level: 'A2',
    title: 'Rain at the picnic',
    body: `On Saturday my friends and I planned a big picnic in the park. In the morning the sky was blue, so we did not take umbrellas. We made sandwiches, played games and listened to music. Then, at three o'clock, the sky turned dark, and it started to rain very hard. We ran to the bus stop with our food and wet blankets. At home we dried our clothes and ate the sandwiches on the kitchen floor. It was the best "picnic" of the summer. Next time we are going to check the weather first!`,
  },
  {
    id: 'a2-guitar',
    level: 'A2',
    title: 'Three chords',
    body: `In January I bought a guitar because I wanted a new hobby. The first week was terrible: my fingers hurt, and the songs sounded awful. My neighbour knocked on the wall two times! But I watched lessons online every evening and learned three chords. With three chords you can play hundreds of simple songs — that was a big surprise for me. Last week I played a song for my friends at a party. They sang with me, and nobody laughed. Now I am going to learn my fourth chord.`,
  },

  {
    id: 'b1-habits',
    level: 'B1',
    title: 'Small habits, big changes',
    body: `Many people believe that big results require big efforts. In reality, small daily habits often matter more. If you read just ten minutes every day, you will finish many books in a year. The same idea works for learning a language. Practising a little every day is more effective than studying for hours once a week, because your brain needs regular repetition to remember new things. The hardest part is usually starting. Once a habit becomes automatic, it feels natural and you no longer need much willpower. So choose one tiny habit, repeat it daily, and let it grow over time.`,
  },
  {
    id: 'b1-travel',
    level: 'B1',
    title: 'A different kind of holiday',
    body: `When Maria planned her holiday, she decided not to visit a famous city. Instead, she chose a small village in the mountains. There were no crowds and no expensive restaurants. Every morning she walked along quiet paths and talked to local people. They were friendly and curious about her life. By the end of the week, Maria felt calm and rested. She realised that a holiday does not have to be exciting to be valuable. Sometimes the best trips are the simple ones, where you slow down and notice the small details around you.`,
  },
  {
    id: 'c1-attention',
    level: 'C1',
    title: 'The economics of attention',
    body: `In an era of endless notifications, attention has become a scarce and valuable resource. Technology companies compete fiercely to capture every spare moment of our focus, designing interfaces that exploit subtle psychological tendencies. The consequence is a peculiar paradox: although we have unprecedented access to information, our capacity to engage with it deeply has arguably diminished. Cultivating sustained concentration now requires deliberate effort and, occasionally, a willingness to be bored. Those who can resist the constant pull of distraction may find themselves at a considerable advantage, not merely in productivity, but in their ability to think independently and form nuanced judgements.`,
  },
  {
    id: 'c1-language',
    level: 'C1',
    title: 'Why fluency fades',
    body: `Language proficiency is rarely permanent. Without regular use, even an advanced speaker may notice a gradual erosion of vocabulary and a creeping hesitation in conversation. This phenomenon, sometimes called language attrition, is entirely natural: the brain prunes connections that are no longer reinforced. The remedy, however, is reassuringly straightforward. Consistent exposure—reading, listening, and above all producing the language—keeps those neural pathways active. What matters is not the intensity of any single session but the steadiness of the habit. A few minutes of meaningful engagement each day will preserve far more than an occasional, exhausting marathon of study.`,
  },

  // --- Дополнительные тексты (авторский контент Recall) ---
  {
    id: 'b1-market',
    level: 'B1',
    title: 'The Saturday market',
    body: `Every Saturday morning, the square in our town turns into a busy market. Farmers arrive early and set up their stalls with fruit, vegetables, cheese and honey. The prices are usually lower than in the supermarket, and the food is fresher. I like talking to the sellers because they always explain where their products come from. Last week an old man taught me how to choose a ripe melon: you should smell it and press it gently near the bottom. Shopping there takes more time than buying everything in one shop, but it never feels boring. For me, the market is not just about food. It is a place where neighbours meet, chat and feel part of the same community.`,
  },
  {
    id: 'b1-phone',
    level: 'B1',
    title: 'A weekend without a phone',
    body: `Last month I tried an experiment: I turned off my phone for the whole weekend. The first hours were difficult. I wanted to check messages, look at photos and read the news. My hand kept reaching for my pocket automatically. But by Saturday evening, something changed. I read fifty pages of a novel, cooked a proper dinner and went for a long walk without counting my steps. On Sunday I met a friend, and we talked for three hours without interruptions. When I turned the phone on again, I had ninety messages, but almost none of them were important. I will not give up my phone completely — it is too useful. However, now I switch it off every Sunday morning, and I feel calmer because of it.`,
  },
  {
    id: 'b1-new-city',
    level: 'B1',
    title: 'Moving to a new city',
    body: `When Daniyar moved to a new city for work, he knew nobody there. The first weeks were lonely: he went to the office, came home and watched films alone. Then he decided to change something. He joined a running club that met twice a week in the park. At first he was nervous, but running together made talking easy. Soon he knew ten people by name, and one of them invited him to a birthday party. There he met even more people. Six months later, the city finally felt like home. Daniyar says the lesson is simple: friends rarely appear by themselves. You have to go where people share your interests and be brave enough to say hello first.`,
  },
  {
    id: 'b1-cooking',
    level: 'B1',
    title: 'Learning to cook from videos',
    body: `My grandmother learned to cook from her mother. I am learning from the internet. When I want to make a new dish, I watch two or three short videos first. Then I write a simple shopping list and try to repeat the steps. Sometimes the result looks nothing like the video. My first pizza was so hard that my flatmate used it as a plate! But every mistake teaches me something: now I know that dough needs time, and that a hot pan is more important than an expensive one. Cooking has also changed how I spend money. I eat out less and invite friends home more often. A home dinner costs less than a restaurant, and honestly, the conversations last longer too.`,
  },
  {
    id: 'b1-sleep',
    level: 'B1',
    title: 'Why sleep is not wasted time',
    body: `Many busy people think that sleep is wasted time. They go to bed late, wake up early and drink coffee all day to survive. Scientists say this is a serious mistake. While we sleep, the brain does important work: it saves new information, cleans itself and prepares for the next day. Students who sleep well before an exam usually remember more than students who study all night. Sleep also protects our health. People who regularly sleep less than six hours get ill more often and feel stressed more quickly. The advice from doctors is boring but simple: go to bed at the same time, keep your bedroom dark and quiet, and put your phone away an hour before sleep. Your tomorrow depends on your tonight.`,
  },

  {
    id: 'b2-remote-work',
    level: 'B2',
    title: 'The office strikes back',
    body: `For a few years, it seemed that offices might disappear completely. Millions of people discovered that they could work perfectly well from their kitchen tables, saving hours of commuting every week. Companies saved money on rent, and some employees moved to cheaper towns or even other countries. Recently, however, many employers have started calling their staff back. They argue that new ideas are born in corridor conversations, that young employees learn faster when they sit next to experienced colleagues, and that team spirit weakens over video calls. Employees are pushing back, pointing out that they are measured by results, not by hours spent at a desk. The likely outcome is a compromise: a hybrid week, in which people gather in the office for meetings and collaboration, and stay at home for focused, quiet work.`,
  },
  {
    id: 'b2-tourism',
    level: 'B2',
    title: 'When tourists become a problem',
    body: `Tourism brings money, jobs and international attention, so for decades cities competed to attract as many visitors as possible. Now some of them are trying to do the opposite. Venice charges day-trippers an entrance fee, Barcelona has limited new hotels, and Amsterdam has asked noisy young tourists directly not to come. The problem is called overtourism: when the number of visitors grows so large that it damages the very things people came to see. Rents rise because flats become holiday apartments, local shops turn into souvenir stalls, and residents move away from historic centres. Finding a balance is difficult. A city cannot simply close its gates, and many families depend on tourists' money. The current experiments — fees, limits and better information — are attempts to keep tourism alive without letting it destroy its host.`,
  },
  {
    id: 'b2-second-language',
    level: 'B2',
    title: 'What bilinguals know',
    body: `People who speak two languages often describe a strange feeling: they seem to have a slightly different personality in each language. Researchers take this seriously. Language is not just a set of labels for objects; it carries habits of politeness, humour and emotional expression. When you switch languages, you also switch these habits. Studies suggest other interesting effects as well. Bilinguals tend to be better at ignoring distractions, perhaps because their brains constantly practise choosing one language and suppressing the other. Some research even indicates that speaking several languages may delay age-related memory problems. None of this means that monolingual people are doomed, of course. But it does suggest that learning a language is more than collecting vocabulary: it is training for the brain and a doorway into another way of seeing the world.`,
  },
  {
    id: 'b2-fast-fashion',
    level: 'B2',
    title: 'The true price of cheap clothes',
    body: `A T-shirt that costs less than a cup of coffee sounds like good news. Yet the real bill arrives later, and someone else usually pays it. Fast fashion brands release new collections every few weeks, encouraging customers to treat clothes as disposable. The environmental cost is enormous: the industry consumes vast amounts of water, and mountains of barely worn garments end up in landfills from Ghana to Chile. The human cost is quieter but just as real — many of those five-dollar shirts are sewn by workers earning wages that barely cover food and rent. Consumers are not powerless, though. Buying fewer, better things, repairing instead of replacing, and choosing second-hand shops all reduce the damage. The most sustainable item of clothing, as one designer put it, is the one already hanging in your wardrobe.`,
  },
  {
    id: 'b2-city-birds',
    level: 'B2',
    title: 'Smarter than we thought',
    body: `City pigeons and crows rarely get much respect, yet urban birds are quietly demonstrating remarkable intelligence. Crows in Japan have learned to drop walnuts onto pedestrian crossings, wait for cars to crack them, and then collect the pieces when the traffic lights turn red. In several European cities, birds have been observed using cigarette butts in their nests — the chemicals appear to keep insects away. Scientists who study animal cognition say that the modern city works like a giant laboratory: it constantly presents animals with new puzzles, and the individuals who solve them survive and multiply. Some researchers now argue that certain crows solve problems at the level of a young child. The next time a bird watches you eat a sandwich with suspicious attention, remember — there may be more calculation behind those eyes than you think.`,
  },

  {
    id: 'c1-expertise',
    level: 'C1',
    title: 'The myth of effortless genius',
    body: `We are drawn to stories of effortless genius: the composer who hears entire symphonies in his head, the athlete who was simply born faster. Such narratives are comforting precisely because they demand nothing of us — talent either strikes or it does not. The research on expertise tells a far less romantic story. Behind nearly every "natural" lies a decade of deliberate practice: structured, uncomfortable work at the edge of one's ability, usually guided by a demanding teacher and punctuated by failure. What genuinely separates high achievers is rarely raw gift but rather the willingness to remain a beginner for longer than everyone else, to seek out criticism, and to treat plateaus as puzzles rather than verdicts. This is, on reflection, encouraging news. It suggests that the ceiling most of us perceive above ourselves is not a law of nature — merely the point at which practice stopped being deliberate.`,
  },
  {
    id: 'c1-boredom',
    level: 'C1',
    title: 'In defence of boredom',
    body: `Boredom has acquired the status of a minor emergency, to be treated instantly with a glance at a glowing screen. Yet psychologists increasingly regard it as a valuable signal rather than a malfunction. Boredom tells us that our current activity has ceased to be meaningful and nudges us to seek something better; muffle that signal often enough, and one risks losing touch with what "better" might even mean. There is also a creative dimension. Studies have repeatedly shown that people who are first bored by a tedious task subsequently outperform others on tests of imagination — the wandering mind, it seems, visits places the focused mind never reaches. None of this romanticises endless idleness. Rather, it suggests that the occasional stretch of unstimulated time is not a void to be filled but a workshop in which the mind repairs, reshuffles and surprises itself.`,
  },
  {
    id: 'c1-translation',
    level: 'C1',
    title: 'What gets lost, what gets found',
    body: `It is fashionable to say that poetry is what gets lost in translation, and the phrase contains an obvious truth: no rendering of Pushkin into English will reproduce the exact weight of his rhymes. Yet the lament obscures a subtler point — translation is not merely a process of loss but one of discovery. A translator must ask questions a casual reader never confronts: what precisely does this word imply, what register does this sentence inhabit, whose voice is speaking beneath the grammar? In answering them, translators frequently illuminate dimensions of the original that native readers had overlooked. Entire literary traditions, moreover, have been transformed by imported forms — the sonnet migrating from Italian, the haiku escaping Japanese. A translated poem is admittedly a different creature from its original. But "different" need not mean "diminished"; occasionally, to the quiet embarrassment of purists, it means enriched.`,
  },
  {
    id: 'c1-attention-span',
    level: 'C1',
    title: 'The goldfish that never existed',
    body: `You have probably heard the claim: thanks to smartphones, the human attention span has shrunk to eight seconds — less than that of a goldfish. The statistic is quoted in boardrooms and staffrooms alike, and it is almost certainly nonsense. Researchers who have tried to trace its origin find no credible study behind it; attention, in any case, is not a single quantity that could shrink like a melting ice cube. We attend selectively, depending on task, motivation and fatigue — the same person who cannot endure a three-minute video may happily binge a five-hour series or spend an afternoon absorbed in a game. What has genuinely changed is not our capacity for attention but the ferocity of the competition for it. That distinction matters: if the problem were biological decay, we would be helpless. Since it is environmental design, we can redesign — beginning, perhaps, with the settings on our own devices.`,
  },
]
