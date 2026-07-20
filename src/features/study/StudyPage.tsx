// ============================================================================
// «Учёба» — хаб материалов (роут /study). Собирает разделы, которые раньше
// занимали отдельные вкладки: чтение, грамматику и определение уровня.
// Сами экраны остались по своим роутам — хаб только ведёт к ним.
// ============================================================================
import { useEffect, useState } from 'react'
import { BookOpenTextIcon, GraduationCapIcon, CompassIcon } from '@phosphor-icons/react'
import { RowCard } from '../../components/RowCard'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'

export function StudyPage() {
  const { lang } = useLanguage()
  const [esLevel, setEsLevel] = useState<string | null>(null)

  // уровень испанского хранится локально; на EN подсказка не нужна
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  const showPlacement = lang === 'es' && !esLevel

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Учёба</h1>
        <p className="text-sm text-[var(--night-text-40)]">
          Тексты, грамматика и всё, что учит языку не только по карточкам.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <RowCard
          Icon={BookOpenTextIcon}
          title="Тексты и диалоги"
          desc={lang === 'es' ? 'Чтение, диалоги, слова в контексте' : 'Чтение и разбор слов по тапу'}
          to="/reader"
          active
          className="animate-fade-up"
          style={{ animationDelay: '.05s' }}
        />
        <RowCard
          Icon={GraduationCapIcon}
          title="Грамматика"
          desc={
            lang === 'es'
              ? 'Уроки A1–B2 и спряжения глаголов'
              : 'Уроки A1–C1 и неправильные глаголы'
          }
          to="/grammar"
          className="animate-fade-up"
          style={{ animationDelay: '.11s' }}
        />
        {showPlacement && (
          <RowCard
            Icon={CompassIcon}
            title="Определи свой уровень"
            desc="48 вопросов — подстроим диалог и подсказки"
            to="/placement"
            dashed
            className="animate-fade-up"
            style={{ animationDelay: '.17s' }}
          />
        )}
      </div>
    </div>
  )
}
