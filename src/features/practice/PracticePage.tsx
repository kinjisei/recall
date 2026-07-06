// ============================================================================
// «Практика» (только испанский) — набор мини-игр вокруг перенесённых слов и фраз.
// Хаб с карточками; выбранная игра открывается на весь экран (со «← Назад»).
// Каждая игра при завершении раунда идёт в стрик (logActivity('practice')).
// ============================================================================
import { useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { Card } from '../../components/Card'
import { IconLink, IconType, IconBlocks, IconHeadphones } from '../../components/icons'
import { MatchGame } from './MatchGame'
import { TranslationDrill } from './TranslationDrill'
import { SentenceBuilder } from './SentenceBuilder'
import { ListeningGame } from './ListeningGame'

type Game = 'match' | 'translation' | 'sentence' | 'listening'
type Tone = 'sky' | 'violet' | 'amber' | 'emerald'

interface GameDef {
  id: Game
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  tone: Tone
  title: string
  desc: string
}

const toneChip: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
}

const games: GameDef[] = [
  { id: 'match', Icon: IconLink, tone: 'sky', title: 'Подбери пару', desc: 'Слово ↔ перевод' },
  { id: 'translation', Icon: IconType, tone: 'violet', title: 'Перевод', desc: 'Выбери перевод' },
  { id: 'sentence', Icon: IconBlocks, tone: 'amber', title: 'Собери фразу', desc: 'Фраза из слов' },
  { id: 'listening', Icon: IconHeadphones, tone: 'emerald', title: 'Аудирование', desc: 'Услышь и выбери' },
]

export function PracticePage() {
  const [game, setGame] = useState<Game | null>(null)

  if (game === 'match') return <MatchGame onBack={() => setGame(null)} />
  if (game === 'translation') return <TranslationDrill onBack={() => setGame(null)} />
  if (game === 'sentence') return <SentenceBuilder onBack={() => setGame(null)} />
  if (game === 'listening') return <ListeningGame onBack={() => setGame(null)} />

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Практика</h1>
      <p className="text-sm text-slate-500">
        Мини-игры на испанских словах и фразах. Любая завершённая игра
        засчитывается в серию дня.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {games.map((g) => (
          <button key={g.id} onClick={() => setGame(g.id)} className="text-left focus-visible:outline-none">
            <Card interactive className="flex h-full flex-col">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneChip[g.tone]}`}>
                <g.Icon className="h-6 w-6" />
              </div>
              <div className="mt-3 font-semibold">{g.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{g.desc}</div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  )
}
