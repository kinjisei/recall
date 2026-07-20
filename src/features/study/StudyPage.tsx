// ============================================================================
// «Учёба» (роут /study, он же /reader) — единый экран входного материала:
// сразу список текстов для чтения, а над ним строки-ссылки на грамматику и
// определение уровня.
//
// Раньше это были два экрана: хаб «Учёба» → «Тексты и диалоги». Чтение —
// ежедневная активность, держать её в двух тапах было неправильно.
// ============================================================================
import { useEffect, useState } from 'react'
import { GraduationCapIcon, CompassIcon, NotePencilIcon } from '@phosphor-icons/react'
import { RowCard } from '../../components/RowCard'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import { getMyAssignments } from '../../lib/materials'
import { ReaderPage } from '../reader/ReaderPage'

export function StudyPage() {
  const { lang } = useLanguage()
  const [esLevel, setEsLevel] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<{ total: number; pending: number } | null>(null)

  // уровень испанского хранится локально; на EN подсказка не нужна
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  // задания от преподавателя раньше можно было найти только карточкой
  // на Главной — и только пока они новые
  useEffect(() => {
    getMyAssignments()
      .then((rows) =>
        setAssignments({
          total: rows.length,
          pending: rows.filter((r) => r.status === 'assigned').length,
        }),
      )
      .catch(() => setAssignments(null))
  }, [])

  const showPlacement = lang === 'es' && !esLevel

  return (
    <ReaderPage
      title="Учёба"
      header={
        <div className="flex flex-col gap-2.5">
          {assignments && assignments.total > 0 && (
            <RowCard
              Icon={NotePencilIcon}
              title="Задания от преподавателя"
              desc={
                assignments.pending > 0
                  ? `Новых: ${assignments.pending} · всего ${assignments.total}`
                  : `Все выполнены · всего ${assignments.total}`
              }
              to="/assignments"
              active={assignments.pending > 0}
              trailing={
                assignments.pending > 0 ? (
                  <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
                    {assignments.pending}
                  </span>
                ) : undefined
              }
              className="animate-fade-up"
            />
          )}
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
