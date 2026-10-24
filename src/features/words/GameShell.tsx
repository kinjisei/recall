// Общие кусочки мини-игр «Практики»: шапка со «‹» (список «Мои слова»),
// загрузка раунда и заглушка «мало слов» — в общей рамке раунда (RoundFrame,
// макет d5). Сам раунд «вопрос + 4 варианта» — QuizRunner.tsx.
import { useNavigate } from 'react-router-dom'
import { IconTray } from '../../shared/ui/icons'
import { BackHeader } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { Loading } from '../../shared/ui/Loading'
import { RoundFrame } from '../../shared/ui/RoundFrame'

export function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  // morph: если сюда пришли тапом по плитке «Практики», заголовок и плитка —
  // один элемент перехода, и экран вырастает из неё (shared/lib/morph.ts)
  return <BackHeader onBack={onBack} title={title} morph />
}

export function GameLoading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <RoundFrame title={title} at={null} total={null} results={[]} onExit={onBack}>
      <Loading label="Готовим раунд" />
    </RoundFrame>
  )
}

export function EmptyPool({ title, onBack }: { title: string; onBack: () => void }) {
  const navigate = useNavigate()
  return (
    <RoundFrame title={title} at={null} total={null} results={[]} onExit={onBack}>
      <Card className="items-center text-center">
        <IconTray size={40} className="text-fg-faint" />
        <p className="mt-2 font-semibold">Пока мало слов для игры</p>
        <p className="mt-1 text-sm text-fg-muted">
          Возьми готовый набор по уровню — или тапни по незнакомому слову в
          любом тексте.
        </p>
        {/* Кнопка ведёт ТУДА, ЧТО ОБЕЩАЕТ. Такая же была в пустой колоде и
            уже починена; эта осталась второй копией того же класса — вела на
            корень «Учёбы», где до слов ещё два тапа. */}
        <Button className="mt-4" onClick={() => navigate('/study?view=words&sheet=packs')}>
          Добавить первые слова
        </Button>
      </Card>
    </RoundFrame>
  )
}
