// ============================================================================
// Карточка материала (макет d8-1 `.det`, PLAN.md Ф2.17-4в-2): название,
// «Английский · A2 · рассказ · 120 слов · 2 упражнения», «Выдан: …», текст и
// упражнения с ответами. Ниже — «Кому выдан» (выдать, убрать, проверить,
// разбор), печать и удаление: в кадре их не видно, карточка прокручивается.
// На компьютере стоит справа от списка, на телефоне — экраном с «‹ Материалы».
// ============================================================================
import { useState } from 'react'
import { assignMaterial, deleteMaterial, listMaterialAssignments, unassignMaterial } from '../../../lib/materials'
import type { StudentInfo } from '../../../lib/teacher'
import { plural } from '../../../shared/lib/plural'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { AppLink } from '../../../shared/ui/AppLink'
import { BackLink } from '../../../shared/ui/BackButton'
import { Button } from '../../../shared/ui/Button'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { IconPrinter, IconTrash } from '../../../shared/ui/icons'
import { LoadError } from '../../../shared/ui/LoadError'
import { RowsSkeleton } from '../../../shared/ui/Loading'
import type { Material, MaterialAssignment } from '../../../types'
import { PrintSheet } from '../PrintSheet'
import { DetailHead, IssuedLine, MaterialBody, StudentRow } from './detailParts'
import { materialKind, materialWords } from './LibraryList'
import { ErrorText } from '../../../shared/ui/ErrorText'

export function MaterialDetail({
  material,
  students,
  initialError,
  onDeleted,
  onBack,
  onWorksChanged,
  onCheck,
  onReview,
}: {
  material: Material
  students: StudentInfo[]
  /** Только что сохранён, но кому-то не назначился — сказать в «Кому выдан». */
  initialError?: string
  onDeleted: () => void
  /** Телефон: карточка — экраном, «‹ Материалы» к списку. На компьютере список рядом. */
  onBack?: () => void
  /** Число работ «на проверку» могло измениться (снятие сданной работы). */
  onWorksChanged?: () => void
  /** Сданная работа — к проверке (та же, что из хаба: листалка по очереди). */
  onCheck: (a: MaterialAssignment) => void
  /** Проверенная — разбор и «Переназначить». */
  onReview: (a: MaterialAssignment, name: string) => void
}) {
  // сбой загрузки назначений НЕ равен «никому не назначено»: иначе учитель
  // видит всех учеников без работы и может переназначить/проглядеть сдачу.
  // Другой материал — экран пересоздаётся (key у MaterialsSection).
  const { data: assignments, error: loadError, reload } = useAsyncData(
    () => listMaterialAssignments(material.id),
    [material.id],
    'Не удалось загрузить назначения',
  )
  const [busyStudent, setBusyStudent] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [printMode, setPrintMode] = useState<'student' | 'teacher' | null>(null)
  const { confirm, dialog } = useConfirm()

  const nameOf = (id: string) => students.find((s) => s.profile.id === id)?.profile.display_name ?? 'Ученик'

  const toggle = async (studentId: string) => {
    const cur = (assignments ?? []).find((a) => a.student_id === studentId)
    // Снятие сданной/проверенной работы стирает ответы, баллы, разбор и всю
    // историю попыток — и делает это без возврата. Спрашиваем подтверждение
    // (у назначенной, но не начатой, терять нечего — снимаем сразу).
    if (cur && cur.status !== 'assigned') {
      const ok = await confirm({
        title: 'Убрать работу?',
        body: 'Ответы ученика, баллы и проверка удалятся — вернуть их будет нельзя.',
        action: 'Убрать',
      })
      if (!ok) return
    }
    setBusyStudent(studentId)
    setError(null)
    try {
      if (cur) {
        await unassignMaterial(material.id, studentId)
        onWorksChanged?.() // работа могла быть на проверке — обновим бейдж
      } else await assignMaterial(material.id, studentId)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyStudent(null)
    }
  }

  const remove = async () => {
    if (deleting) return
    const ok = await confirm({
      title: 'Удалить материал?',
      body: 'Назначения учеников и их ответы удалятся вместе с ним.',
      action: 'Удалить',
    })
    if (!ok) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMaterial(material.id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить')
      setDeleting(false)
    }
  }

  const n = material.exercises.length
  return (
    <div className="flex flex-col gap-3.5">
      {onBack && (
        <div className="self-start">
          <BackLink onClick={onBack} label="Материалы" />
        </div>
      )}
      <article className="flex flex-col gap-3.5 rounded-card bg-surface px-6.5 py-5.5 shadow-card">
        <h2 lang={material.lang} className="text-2xl font-semibold tracking-tight text-fg">
          {material.title ?? material.topic}
        </h2>
        <span className="-mt-1.5 text-sm text-fg-secondary">
          {materialKind(material)} · {materialWords(material)} · {n} {plural(n, 'упражнение', 'упражнения', 'упражнений')}
        </span>
        {loadError ? (
          <LoadError message={loadError} onRetry={reload} />
        ) : !assignments ? (
          <RowsSkeleton count={1} height={40} />
        ) : (
          <IssuedLine assignments={assignments} nameOf={nameOf} />
        )}
        <MaterialBody material={material} />
      </article>

      <section aria-label="Кому выдан" className="flex flex-col rounded-card bg-surface px-5 py-4 shadow-card">
        <DetailHead>Кому выдан</DetailHead>
        {students.length === 0 ? (
          // Пустое состояние без выхода: материал уже стоил двух генераций, а
          // код-приглашение живёт на другой вкладке (находка ревью 2В).
          <p className="mt-2 text-sm text-fg-muted">
            Учеников пока нет. Отправь код-приглашение — он на вкладке{' '}
            <AppLink to="/teacher" className="text-accent-strong underline underline-offset-2">
              «Ученики»
            </AppLink>
            . Как только кто-то привяжется, материал выдаётся в один тап.
          </p>
        ) : !assignments && !loadError ? (
          <RowsSkeleton count={2} height={56} />
        ) : (
          <div className="mt-1 flex flex-col">
            {students.map((s) => {
              const a = (assignments ?? []).find((x) => x.student_id === s.profile.id)
              const name = s.profile.display_name ?? 'Без имени'
              return (
                <StudentRow key={s.profile.id} name={name} assignment={a}>
                  {a?.status === 'submitted' && (
                    <Button size="sm" variant="secondary" onClick={() => onCheck(a)}>
                      Проверить
                    </Button>
                  )}
                  {a?.status === 'reviewed' && (
                    <Button size="sm" variant="outline" onClick={() => onReview(a, name)}>
                      Разбор
                    </Button>
                  )}
                  <Button size="sm" variant={a ? 'ghost' : 'outline'} disabled={busyStudent !== null || !!loadError} loading={busyStudent === s.profile.id} onClick={() => toggle(s.profile.id)}>
                    {a ? 'Убрать' : 'Выдать'}
                  </Button>
                </StudentRow>
              )
            })}
          </div>
        )}
        {error && <ErrorText className="mt-2">{error}</ErrorText>}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPrintMode('student')}>
          <IconPrinter size={16} aria-hidden /> Для ученика
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPrintMode('teacher')}>
          <IconPrinter size={16} aria-hidden /> С ответами
        </Button>
        <Button size="sm" variant="danger" className="ml-auto" onClick={remove} loading={deleting}>
          <IconTrash size={16} aria-hidden /> Удалить материал
        </Button>
      </div>

      {printMode && <PrintSheet material={material} withAnswers={printMode === 'teacher'} onClose={() => setPrintMode(null)} />}
      {dialog}
    </div>
  )
}
