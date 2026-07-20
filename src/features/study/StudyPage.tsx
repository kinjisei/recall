// ============================================================================
// «Учёба» (роут /study, он же /reader) — единый экран входного материала:
// сразу список текстов для чтения, а над ним строки-ссылки на грамматику и
// определение уровня.
//
// Раньше это были два экрана: хаб «Учёба» → «Тексты и диалоги». Чтение —
// ежедневная активность, держать её в двух тапах было неправильно.
// ============================================================================
import { useEffect, useState } from 'react'
import { GraduationCapIcon, CompassIcon } from '@phosphor-icons/react'
import { RowCard } from '../../components/RowCard'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import { ReaderPage } from '../reader/ReaderPage'

export function StudyPage() {
  const { lang } = useLanguage()
  const [esLevel, setEsLevel] = useState<string | null>(null)

  // уровень испанского хранится локально; на EN подсказка не нужна
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  const showPlacement = lang === 'es' && !esLevel

  return (
    <ReaderPage
      title="Учёба"
      header={
        <div className="flex flex-col gap-2.5">
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
          />
          {showPlacement && (
            <RowCard
              Icon={CompassIcon}
              title="Определи свой уровень"
              desc="48 вопросов — подстроим диалог и подсказки"
              to="/placement"
              dashed
              className="animate-fade-up"
              style={{ animationDelay: '.06s' }}
            />
          )}
        </div>
      }
    />
  )
}
