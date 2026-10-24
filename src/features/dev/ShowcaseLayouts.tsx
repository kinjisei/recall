// Витрина: общие раскладки на примерах (только в разработке, см. UiShowcase).
import { useState } from 'react'
import { useUrlState } from '../../shared/lib/useUrlState'
import { BackHeader } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { IconColumns, IconHome, IconMaterials, IconPuzzle, IconRows, type IconLike } from '../../shared/ui/icons'
import { CenterColumn, EvenColumns, ListDetail, MainAside, ReadingColumn } from '../../shared/ui/layouts'
import { RowCard } from '../../shared/ui/RowCard'

export type LayoutId = 'center' | 'reading' | 'list' | 'main' | 'even'

export const LAYOUTS: { id: LayoutId; title: string; desc: string; Icon: IconLike }[] = [
  { id: 'center', title: 'Колонка по центру', desc: 'Упражнения, игры', Icon: IconPuzzle },
  { id: 'reading', title: 'Колонка чтения', desc: 'Текст + перевод слова сбоку', Icon: IconMaterials },
  { id: 'list', title: 'Список + подробности', desc: 'Ученики, материалы', Icon: IconRows },
  { id: 'main', title: 'Главная + правая', desc: '«Моя учёба»', Icon: IconHome },
  { id: 'even', title: 'Две равные колонки', desc: 'Главная ученика', Icon: IconColumns },
]

const TEXT =
  'Every morning Anna walks her dog along the river before work. The air is cold and quiet, and the city is still asleep.'

const PEOPLE = ['Айгерим', 'Данияр', 'Мадина', 'Тимур']

export function LayoutDemo({ id, onBack }: { id: LayoutId; onBack: () => void }) {
  const title = LAYOUTS.find((l) => l.id === id)?.title ?? ''
  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title={title} />
      {id === 'center' && <CenterDemo />}
      {id === 'reading' && <ReadingDemo />}
      {id === 'list' && <ListDemo />}
      {id === 'main' && <MainDemo />}
      {id === 'even' && <EvenDemo />}
    </div>
  )
}

function CenterDemo() {
  return (
    <CenterColumn
      left={<p data-demo="progress">Шаг 3 из 8</p>}
      right={<p data-demo="keys">1–4 — ответ · Enter — дальше · Esc — выйти</p>}
    >
      <div data-demo="center">
        <Card className="flex flex-col gap-3">
          <p className="text-lg font-medium">Выбери перевод: «river»</p>
          {['река', 'дорога', 'город', 'утро'].map((o) => (
            <button key={o} className="rounded-control border border-tint/[0.10] px-4 py-2.5 text-left">
              {o}
            </button>
          ))}
        </Card>
      </div>
    </CenterColumn>
  )
}

function ReadingDemo() {
  const [word, setWord] = useState<string | null>(null)
  return (
    <ReadingColumn
      aside={
        word && (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-medium">{word}</p>
            <p className="text-sm text-fg-muted">Перевод и пример появятся здесь.</p>
            <Button variant="secondary" onClick={() => setWord(null)}>
              Закрыть
            </Button>
          </div>
        )
      }
      onAsideClose={() => setWord(null)}
      asideLabel="Перевод слова"
      asideHint="Нажми на слово — перевод появится здесь."
    >
      <Card>
        <p className="text-lg leading-relaxed" data-demo="reading">
          {TEXT.split(' ').map((w, i) => (
            <button key={i} className="mr-1 rounded-mark hover:bg-accent-soft" onClick={() => setWord(w.replace(/[.,]/g, ''))}>
              {w}
            </button>
          ))}
        </p>
      </Card>
    </ReadingColumn>
  )
}

function ListDemo() {
  const [who, setWho] = useUrlState('who', (v) => PEOPLE.includes(v))
  const list = (
    <div className="flex flex-col gap-2" data-demo="list">
      {PEOPLE.map((p) => (
        <RowCard key={p} Icon={IconRows} title={p} desc="домашка: 1 из 2" active={p === who} onClick={() => setWho(p)} />
      ))}
    </div>
  )
  const detail = who && (
    <div data-demo="detail">
      <Card className="flex flex-col gap-2">
        <p className="text-lg font-medium">{who}</p>
        <p className="text-sm text-fg-muted">Карточка ученика: домашка, слова, заметки.</p>
      </Card>
    </div>
  )
  return <ListDetail list={list} detail={detail || null} empty="Выбери ученика слева" />
}

function MainDemo() {
  return (
    <MainAside
      main={
        <div data-demo="main">
          <Card className="flex flex-col gap-3">
            <p className="text-lg font-medium">Начать занятие</p>
            <p className="text-sm text-fg-muted">Главное действие экрана — в главной колонке.</p>
          </Card>
        </div>
      }
      aside={
        <div data-demo="aside">
          <Card className="flex flex-col gap-2">
            <p className="font-medium">Ближайший урок</p>
            <p className="text-sm text-fg-muted">То, что сверяют, а не делают.</p>
          </Card>
        </div>
      }
    />
  )
}

function EvenDemo() {
  const card = (demo: string, title: string, desc: string) => (
    <div key={demo} data-demo={demo}>
      <Card className="flex h-full flex-col gap-2">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-fg-muted">{desc}</p>
      </Card>
    </div>
  )
  const streak = card('pair-left', 'Серия дней подряд', 'Пара первого ряда — одной высоты.')
  const lesson = card('pair-right', 'Ближайший урок', 'Высоту ряда держит большая карточка.')
  const plan = card('left', '«Начать занятие» и план', 'Левая стопка — своей высоты.')
  const side = card('right', 'Домашка, слово дня, энергия', 'Правая стопка — своей высоты.')
  return <EvenColumns pair={[streak, lesson]} left={plan} right={side} stack={[lesson, plan, streak, side]} />
}
