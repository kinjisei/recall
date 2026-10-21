// Описание: src/features/teacher/CLAUDE.md
// ============================================================================
// «Удалить задание» в карточке письменного задания (макет d9-1 `.del9`): под
// чертой — что пропадёт и красная кнопка контуром; необратимое — спросить
// диалогом по центру (useConfirm), потом удалить. Вынесено из карточки:
// большой файл не растёт (сторож размера).
// ============================================================================
import { useState } from 'react'
import { deleteWritingTask } from '../../lib/writing'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { IconTrash } from '../../shared/ui/icons'

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
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
      {/* подпись сжимается в две строки, а не уводит кнопку вниз (d9-1); узко — кнопка строкой ниже */}
      <span className="min-w-0 flex-1 basis-48 text-sm text-fg-muted">Сданные работы и разборы удалятся вместе с заданием</span>
      <Button size="sm" variant="danger-outline" onClick={() => void remove()} loading={deleting}>
        <IconTrash size={16} aria-hidden /> Удалить задание
      </Button>
      {dialog}
    </div>
  )
}
