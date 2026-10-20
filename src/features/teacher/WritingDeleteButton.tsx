// Описание: src/features/teacher/CLAUDE.md
// ============================================================================
// «Удалить задание» в карточке письменного задания: необратимое — спросить
// диалогом по центру (useConfirm), потом удалить. Вынесено из WritingSection:
// большой файл не растёт (сторож размера).
// ============================================================================
import { useState } from 'react'
import { deleteWritingTask } from '../../lib/writing'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'

export function WritingDeleteButton({ taskId, onDeleted, onError }: { taskId: string; onDeleted: () => void; onError: (message: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const { confirm, dialog } = useConfirm()

  const remove = async () => {
    const ok = await confirm({
      title: 'Удалить задание?',
      body: 'Назначения ученикам и сданные по нему работы пропадут.',
      action: 'Удалить',
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteWritingTask(taskId)
      onDeleted()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось удалить')
      setDeleting(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="self-start text-danger" onClick={() => void remove()} loading={deleting}>
        Удалить задание
      </Button>
      {dialog}
    </>
  )
}
