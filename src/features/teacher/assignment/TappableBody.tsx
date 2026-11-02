// ============================================================================
// Текст задания: тап-словарь + режим «Отметить слова» (общий MarkableText) —
// один на чтение перед упражнениями и на разбор проверенной работы.
// ============================================================================
import { MarkableText } from '../../../components/MarkableText'
import type { AppLang, Material, MaterialAssignment } from '../../../types'

/** Задание ученика вместе с материалом (ответ `getMyAssignments`). */
export type Row = MaterialAssignment & { material: Material }

export function TappableBody({ body, lang }: { body: string; lang: AppLang }) {
  return (
    <div className="mt-3">
      <MarkableText
        text={body}
        lang={lang}
        className="whitespace-pre-wrap leading-relaxed text-fg-secondary"
      />
    </div>
  )
}
