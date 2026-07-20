// ============================================================================
// «Учёба» (роут /study, он же /reader) — единый экран входного материала:
// сразу список текстов для чтения, а над ним строки-ссылки на грамматику и
// определение уровня.
//
// Раньше это были два экрана: хаб «Учёба» → «Тексты и диалоги». Чтение —
// ежедневная активность, держать её в двух тапах было неправильно.
// ============================================================================
import { useEffect, useState } from 'react'
import { BarbellIcon, GraduationCapIcon, CompassIcon, NotePencilIcon } from '@phosphor-icons/react'
import { RowCard } from '../../components/RowCard'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'
import { getEsLevel } from '../../lib/esLevel'
import { getMyAssignments } from '../../lib/materials'
import { ReaderPage } from '../reader/ReaderPage'

export function StudyPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const [esLevel, setEsLevel] = useState<string | null>(null)
  // null — уровень не задан (показываем тест); undefined — ещё грузится
  const [enLevel, setEnLevel] = useState<string | null | undefined>(undefined)
  const [assignments, setAssignments] = useState<{ total: number; pending: number } | null>(null)

  // уровень испанского хранится локально, английского — в профиле
  useEffect(() => {
    setEsLevel(getEsLevel())
  }, [lang])

  useEffect(() => {
    if (lang !== 'en' || !user) return
    supabase
      .from('profiles')
      .select('level')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setEnLevel((data?.level as string | null) ?? null))
  }, [lang, user])

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
      .catch(() => setAssignments(null)) // строка просто не появится — не вводим в заблуждение цифрой
  }, [])

  // тест уровня доступен ВСЕГДА (ученик — когда захочет, преподаватель может
  // попросить пройти заново); меняется только подача строки
  const level = lang === 'es' ? esLevel : (enLevel ?? null)
  const levelLoading = lang === 'en' && enLevel === undefined

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
          <RowCard
            Icon={BarbellIcon}
            title="Практика"
            desc="Все мини-игры: слова, грамматика, речь"
            to="/practice"
            className="animate-fade-up"
            style={{ animationDelay: '.04s' }}
          />
          {!levelLoading && (
            <RowCard
              Icon={CompassIcon}
              title={level ? `Твой уровень: ${level}` : 'Определи свой уровень'}
              desc={
                level
                  ? 'Пройти тест заново — вдруг уже вырос?'
                  : `До ${lang === 'es' ? 40 : 50} вопросов — подстроим диалог и подсказки`
              }
              to="/placement"
              dashed={!level}
              className="animate-fade-up"
              style={{ animationDelay: '.08s' }}
            />
          )}
        </div>
      }
    />
  )
}
