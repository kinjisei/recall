// Карточка сохранённого материала: показ текста, печать, назначение ученикам,
// открытие проверки сданной работы, удаление.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { BackHeader } from '../../../components/BackButton'
import { LoadError } from '../../../components/LoadError'
import { IconPrinter, IconTrash } from '../../../components/icons'
import {
  assignMaterial,
  deleteMaterial,
  listMaterialAssignments,
  unassignMaterial,
} from '../../../lib/materials'
import type { StudentInfo } from '../../../lib/teacher'
import type { Material, MaterialAssignment } from '../../../types'
import { ReviewScreen } from '../ReviewScreen'
import { PrintSheet } from '../PrintSheet'

export function MaterialDetail({
  material,
  students,
  initialReview,
  onDeleted,
  onBack,
  onWorksChanged,
}: {
  material: Material
  students: StudentInfo[]
  /** Открыть сразу проверку конкретной работы (из блока «На проверку»). */
  initialReview?: { a: MaterialAssignment; name: string }
  onDeleted: () => void
  onBack: () => void
  /** Число работ «на проверку» могло измениться (снятие сданной работы). */
  onWorksChanged?: () => void
}) {
  const [assignments, setAssignments] = useState<MaterialAssignment[] | null>(null)
  // сбой загрузки назначений НЕ равен «никому не назначено»: иначе учитель
  // видит всех учеников без работы и может переназначить/проглядеть сдачу
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyStudent, setBusyStudent] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBody, setShowBody] = useState(false)
  const [reviewing, setReviewing] = useState<{ a: MaterialAssignment; name: string } | null>(
    initialReview ?? null,
  )
  const [printMode, setPrintMode] = useState<'student' | 'teacher' | null>(null)

  const reload = useCallback(() => {
    setLoadError(null)
    listMaterialAssignments(material.id)
      .then((rows) => setAssignments(rows))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить назначения'))
  }, [material.id])

  useEffect(() => {
    reload()
  }, [reload])

  const assignedIds = new Set((assignments ?? []).map((a) => a.student_id))

  const toggle = async (studentId: string) => {
    const cur = (assignments ?? []).find((a) => a.student_id === studentId)
    // Снятие сданной/проверенной работы стирает ответы, баллы, разбор и всю
    // историю попыток — и делает это без возврата. Спрашиваем подтверждение
    // (у назначенной, но не начатой, терять нечего — снимаем сразу).
    if (cur && cur.status !== 'assigned') {
      if (
        !window.confirm(
          'Убрать эту работу? Ответы ученика, баллы и проверка удалятся без возможности вернуть.',
        )
      ) {
        return
      }
    }
    setBusyStudent(studentId)
    setError(null)
    try {
      if (assignedIds.has(studentId)) {
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
    if (!window.confirm('Удалить материал? Назначения учеников тоже удалятся.')) return
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

  if (reviewing) {
    return (
      <ReviewScreen
        material={material}
        assignment={reviewing.a}
        studentName={reviewing.name}
        onDone={() => {
          setReviewing(null)
          reload()
        }}
        onBack={() => setReviewing(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title={material.title ?? material.topic} label="К материалам" />

      <Card>
        <p className="text-xs text-[var(--night-text-40)]">
          {material.lang.toUpperCase()} · {material.level} · {material.format} ·{' '}
          {material.length_range} слов · {material.exercises.length} упр.
        </p>
        <button
          onClick={() => setShowBody((s) => !s)}
          className="mt-2 text-sm font-medium text-[var(--night-accent-text)] hover:underline"
        >
          {showBody ? '▾ Скрыть текст' : '▸ Показать текст'}
        </button>
        {showBody && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--night-text-70)]">
            {material.body}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => setPrintMode('student')}
          >
            <IconPrinter size={16} /> Для ученика
          </Button>
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => setPrintMode('teacher')}
          >
            <IconPrinter size={16} /> С ответами
          </Button>
        </div>
      </Card>

      {printMode && (
        <PrintSheet
          material={material}
          withAnswers={printMode === 'teacher'}
          onClose={() => setPrintMode(null)}
        />
      )}

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Назначить ученикам</p>
        {loadError ? (
          <LoadError message={loadError} onRetry={reload} />
        ) : assignments === null ? (
          <p className="text-sm text-[var(--night-text-40)]">Загрузка…</p>
        ) : students.length === 0 ? (
          // Пустое состояние без выхода: материал уже стоил двух генераций, а
          // код-приглашение живёт на другой вкладке, и здесь о нём не говорили
          // ни слова (находка ревью 2В).
          <p className="text-sm text-[var(--night-text-40)]">
            Учеников пока нет. Отправь код-приглашение — он на вкладке{' '}
            <Link to="/teacher" className="text-[var(--night-accent-text)] underline underline-offset-2">
              «Ученики»
            </Link>
            . Как только кто-то привяжется, материал назначается в один тап.
          </p>
        ) : (
          students.map((s) => {
            const a = (assignments ?? []).find((x) => x.student_id === s.profile.id)
            const name = s.profile.display_name ?? 'Без имени'
            const teacherOk = (a?.teacher_review ?? []).filter((r) => r.ok).length
            return (
              <div
                key={s.profile.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  {a && (
                    <p className="text-xs text-[var(--night-text-40)]">
                      {a.status === 'assigned'
                        ? 'ещё не выполнено'
                        : a.status === 'submitted'
                          ? `на проверке · авто ${a.auto_score}/${a.auto_total}`
                          : `✓ проверено: ${teacherOk}/${a.auto_total}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {a && a.status !== 'assigned' && (
                    <Button
                      className="px-3 py-1.5 text-sm"
                      onClick={() => setReviewing({ a, name })}
                    >
                      {a.status === 'submitted' ? 'Проверить' : 'Разбор'}
                    </Button>
                  )}
                  <Button
                    variant={a ? 'ghost' : 'secondary'}
                    className="px-3 py-1.5 text-sm"
                    disabled={busyStudent !== null}
                    onClick={() => toggle(s.profile.id)}
                  >
                    {busyStudent === s.profile.id ? '…' : a ? 'Убрать ✓' : 'Назначить'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </Card>

      <Button
        variant="ghost"
        className="self-start text-sm text-red-500"
        onClick={remove}
        loading={deleting}
      >
        <IconTrash size={16} /> Удалить материал
      </Button>
    </div>
  )
}
