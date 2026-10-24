// ============================================================================
// Скелетон Главной — повторяет РАСКЛАДКУ, а не просто «что-то серое»: после
// загрузки ничего не сдвигается. Высоты — как у настоящих блоков (u1, d4-v2):
// серия 216 / 196, «Начать занятие» 60 + подпись, строки плана 64, карточка
// с планом 400. Полосы — токен skeleton и общая пульсация (лист s3).
// ============================================================================
import { useEvenColumnsSplit } from '../../shared/ui/layouts'

const BAR = 'animate-skeleton bg-skeleton'

export function HomeSkeleton() {
  const wide = useEvenColumnsSplit()
  const header = (
    <header className="flex flex-col gap-2 px-1 pt-1">
      <div className={`${BAR} h-8 w-56 rounded-tag`} />
      <div className={`${BAR} h-4 w-36 rounded-full`} />
    </header>
  )
  if (wide) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Загружаем главную">
        {header}
        <div className="grid grid-cols-2 gap-5">
          <div className={`${BAR} h-49 rounded-card`} />
          <div className={`${BAR} h-49 rounded-card`} />
          <div className={`${BAR} h-100 rounded-card`} />
          <div className="flex flex-col gap-3">
            <div className={`${BAR} h-19 rounded-row`} />
            <div className={`${BAR} h-25 rounded-card`} />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-main flex-col gap-4.5" aria-busy="true" aria-label="Загружаем главную">
      {header}
      <div className={`${BAR} h-15 rounded-control-lg`} />
      <div className={`${BAR} h-54 rounded-card`} />
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${BAR} h-14 rounded-row`} />
        ))}
      </div>
    </div>
  )
}
