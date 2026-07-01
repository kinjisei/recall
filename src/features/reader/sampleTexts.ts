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
]
